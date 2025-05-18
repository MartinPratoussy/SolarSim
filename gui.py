import pygame_gui
import pygame
from pygame_gui.elements import UIHorizontalSlider, UILabel
from config import *

class GameUI:
    def __init__(self, width, height):
        self.manager = pygame_gui.UIManager((width, height))
        self.font = pygame.font.SysFont(None, 24)

        # Sun slider
        self.slider_sun = UIHorizontalSlider(
            relative_rect=pygame.Rect(10, 10, 300, 30),
            start_value=1.0,
            value_range=(0.5, 2.0),
            manager=self.manager
        )
        self.label_sun = UILabel(
            relative_rect=pygame.Rect(320, 10, 100, 30),
            text="Sun Mass",
            manager=self.manager
        )
        self.indicator_sun = UILabel(
            relative_rect=pygame.Rect(430, 10, 100, 30),
            text=str(self.slider_sun.get_current_value()),
            manager=self.manager
        )
        
    def get_sun_slider_value(self):
        return (
            self.slider_sun.get_current_value()
        )

    def update(self, time_delta):
        self.manager.update(time_delta)
        # Update indicator label text with current slider value (format nicely)
        val = self.slider_sun.get_current_value() * MASS_SUN
        self.indicator_sun.set_text(f"{val:.2e}")
        # Draw UI on screen
        self.manager.draw_ui(pygame.display.get_surface())

    def process_events(self, event):
        self.manager.process_events(event)
