import pygame
import sys
import math
import pygame_gui
from pygame_gui.elements import UISelectionList
from logic import Body, SolarSystem
from gui import GameUI
from config import *

# Pygame setup
pygame.init()
WIDTH, HEIGHT = 1200, 900
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Solar System Simulator")
clock = pygame.time.Clock()

time_delta = clock.tick(60) / 1000.0

# Initialize GUI
ui = GameUI(WIDTH, HEIGHT)

# Create celestial bodies
sun = Body("Sun", 0, 0, 50, (255, 255, 0), MASS_SUN)

# Create solar system
solar_system = SolarSystem([sun])

selected_type = "Planet"  # default
selection_menu = None

# Main loop
while True:
    screen.fill((0, 0, 0))  # Clear the screen

    # Event handling
    for event in pygame.event.get():
        
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
            
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 3:
            if selection_menu:
                selection_menu.kill()
            selection_menu = UISelectionList(
                pygame.Rect(event.pos[0], event.pos[1], 120, 90),
                item_list = [
                    "Planet (1e23 kg)",
                    "Moon (1e20 kg)",
                    "Asteroid (1e17 kg)"
                ],
                manager=ui.manager
            )
            
        if event.type == pygame_gui.UI_SELECTION_LIST_NEW_SELECTION:
            selected_type = event.text.split()[0] # gets "Planet", "Moon", or "Asteroid"
            if selection_menu:
                selection_menu.kill()
                selection_menu = None
            
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            mx, my = pygame.mouse.get_pos()
            # Convert screen coords to sim coords
            sx = (mx - WIDTH / 2) / SCALE
            sy = (my - HEIGHT / 2) / SCALE
            if selected_type != "Asteroid":
                # Calculate velocity for stable orbit around the sun
                dx = sx - sun.x
                dy = sy - sun.y
                distance = math.sqrt(dx**2 + dy**2)
                angle = math.atan2(dy, dx)
                speed = math.sqrt(G * sun.mass / distance)
                # Perpendicular velocity (for orbit)
                vx = -math.sin(angle) * speed
                vy = math.cos(angle) * speed
            else:
                # asteroid comes from nowhere, slow drift toward center
                vx = vy = 0
            
            if selected_type == "Planet":
                mass = 1e23 * MASS_BOOST
                radius = 8
                color = (0, 150, 255)
            elif selected_type == "Moon":
                mass = 1e20 * MASS_BOOST
                radius = 5
                color = (200, 200, 255)
            elif selected_type == "Asteroid":
                mass = 1e17 * MASS_BOOST
                radius = 3
                color = (180, 180, 180)

            new_body = Body(selected_type, sx, sy, radius, color, mass, vx, vy)
            solar_system.bodies.append(new_body)

        ui.process_events(event)

    # Update masses based on slider values
    sun.mass = MASS_SUN * ui.get_sun_slider_value()

    # Update solar system
    solar_system.update(TIMESTEP)

    # Draw celestial bodies
    for body in solar_system.bodies:
        body.draw(screen, SCALE, WIDTH, HEIGHT)

    # Draw the GUI elements
    ui.update(time_delta)

    pygame.display.flip()
    clock.tick(60)
