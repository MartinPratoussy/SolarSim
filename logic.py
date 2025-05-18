import math
import pygame
from config import G

class Body:
    def __init__(self, name, x, y, radius, color, mass, vx=0, vy=0, texture=None):
        self.name = name
        self.x = x
        self.y = y
        self.radius = radius
        self.color = color
        self.mass = mass
        self.vx = vx
        self.vy = vy
        self.orbit = []
        self.texture = texture

    def draw(self, surface, scale, width, height):
        x = self.x * scale + width / 2
        y = self.y * scale + height / 2

        if self.texture:
            image = pygame.transform.scale(self.texture, (self.radius * 2, self.radius * 2))
            surface.blit(image, (x - self.radius, y - self.radius))
        else:
            pygame.draw.circle(surface, self.color, (int(x), int(y)), self.radius)

        if len(self.orbit) > 2:
            points = [(pt[0] * scale + width / 2, pt[1] * scale + height / 2) for pt in self.orbit]
            pygame.draw.lines(surface, self.color, False, points, 1)

    def update(self, fx, fy, timestep):
        self.vx += fx / self.mass * timestep
        self.vy += fy / self.mass * timestep
        self.x += self.vx * timestep
        self.y += self.vy * timestep
        self.orbit.append((self.x, self.y))
        if len(self.orbit) > 500:
            self.orbit.pop(0)

class SolarSystem:
    def __init__(self, bodies):
        self.bodies = bodies

    def calculate_forces(self):
        forces = {body: [0.0, 0.0] for body in self.bodies}

        sun = next((b for b in self.bodies if b.name == "Sun"), None)
        if not sun:
            return forces
        
        for i, body1 in enumerate(self.bodies):
            for j, body2 in enumerate(self.bodies):
                if i == j:
                    continue
                dx = body2.x - body1.x
                dy = body2.y - body1.y
                distance = math.sqrt(dx**2 + dy**2)
                if distance == 0:
                    continue
                force = G * body1.mass * body2.mass / distance**2
                angle = math.atan2(dy, dx)
                fx = math.cos(angle) * force
                fy = math.sin(angle) * force
                forces[body1][0] += fx
                forces[body1][1] += fy

        return forces

    def update(self, timestep):
        forces = self.calculate_forces()
        for body in self.bodies:
            fx, fy = forces[body]
            body.update(fx, fy, timestep)
