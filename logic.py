import math
import random
import pygame
from config import G, SCALE

class Body:
    def __init__(self, name, x, y, draw_radius, color, mass, vx=0, vy=0, texture=None, real_radius=None, collidable=True):
        self.name = name
        self.x = x
        self.y = y
        self.radius = draw_radius
        self.real_radius = real_radius if real_radius else draw_radius / SCALE  # in sim units
        self.color = color
        self.mass = mass
        self.vx = vx
        self.vy = vy
        self.orbit = []
        self.texture = texture
        self.collidable=collidable

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
        self.explosions = []

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
    
    def handle_collisions(self):
        if len(self.bodies) < 2:
            return
        
        new_bodies = []
        removed = set()
        self.explosions = []  # Track visual explosions
        
        for i, body1 in enumerate(self.bodies):
            if  body1 in removed:
                continue
            for j, body2 in enumerate(self.bodies[i+1:], start=i+1):
                if not body1.collidable or not body2.collidable:
                    continue
                if body2 in removed:
                    continue
                dx = body1.x - body2.x
                dy = body1.y - body2.y
                distance = math.sqrt(dx**2 + dy**2)
                if distance < (body1.real_radius*100 + body2.real_radius*100):
                    # Merge masses and momentum
                    total_mass = body1.mass + body2.mass
                    new_x = (body1.x * body1.mass + body2.x * body2.mass) / total_mass
                    new_y = (body1.y * body1.mass + body2.y * body2.mass) / total_mass
                    new_vx = (body1.vx * body1.mass + body2.vx * body2.mass) / total_mass
                    new_vy = (body1.vy * body1.mass + body2.vy * body2.mass) / total_mass

                    new_radius = (body1.radius ** 1.5 + body2.radius ** 1.5) ** (1 / 1.5)
                    new_real_radius = (body1.real_radius ** 1.5 + body2.real_radius ** 1.5) ** (1 / 1.5)

                    merged = Body("Merged", new_x, new_y, new_radius,
                                (255, 100, 0), total_mass, new_vx, new_vy,
                                real_radius=new_real_radius)

                    new_bodies.append(merged)
                    removed.update([body1, body2])

                    self.explosions.append((new_x, new_y, new_radius))

                    # Create debris
                    for _ in range(5):
                        angle = random.uniform(0, 2 * math.pi)
                        speed = random.uniform(20000, 50000)
                        debris_vx = new_vx + math.cos(angle) * speed
                        debris_vy = new_vy + math.sin(angle) * speed
                        debris = Body("Debris", new_x, new_y, 2, (200, 200, 200),
                                    1e16, debris_vx, debris_vy, real_radius=1e5, collidable=False)
                        new_bodies.append(debris)

                    break
            else:
                if body1 not in removed:
                    new_bodies.append(body1)

        self.bodies = new_bodies
        
    def draw_explosions(self, surface, scale, width, height):
        for x, y, r in self.explosions:
            screen_x = int(x * scale + width / 2)
            screen_y = int(y * scale + height / 2)
            pygame.draw.circle(surface, (255, 100, 0), (screen_x, screen_y), int(r * scale * 1.5), 2)
            pygame.draw.circle(surface, (255, 200, 100), (screen_x, screen_y), int(r * scale), 1)
        self.explosions.clear()  # Clear after 1 frame


    def update(self, timestep):
        forces = self.calculate_forces()
        for body in self.bodies:
            fx, fy = forces[body]
            body.update(fx, fy, timestep)
        self.handle_collisions()
