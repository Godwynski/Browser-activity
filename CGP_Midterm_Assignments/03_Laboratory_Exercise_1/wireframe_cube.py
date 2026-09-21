"""
================================================================================
Course:       IT2202 - Computer Graphics Programming
Activity:     03 Laboratory Exercise 1: Pygame and OpenGL: Wireframe Cube
Student Name: Godwyn Neri
Term:         Midterm
Objective:    Set up 3D graphics rendering using Pygame and OpenGL bindings,
              defining vertex geometry, edge topologies, perspective projection,
              and real-time rotational transformations.
================================================================================
"""

import sys
import pygame
from pygame.locals import *

from OpenGL.GL import *
from OpenGL.GLU import *

# -----------------------------------------------------------------------------
# Step 14: Define 3D Vertices of the Cube (8 vertices)
# Dimensions specified in 03 Laboratory Exercise 1, Page 3:
# Vertex 0: ( 1,  1,  1)
# Vertex 1: ( 1,  1, -1)
# Vertex 2: ( 1, -1, -1)
# Vertex 3: ( 1, -1,  1)
# Vertex 4: (-1,  1,  1)
# Vertex 5: (-1, -1, -1)
# Vertex 6: (-1, -1,  1)
# Vertex 7: (-1,  1, -1)
# -----------------------------------------------------------------------------
vertices = (
    (1, 1, 1),    # Vertex 0: Front Top Right
    (1, 1, -1),   # Vertex 1: Back Top Right
    (1, -1, -1),  # Vertex 2: Back Bottom Right
    (1, -1, 1),   # Vertex 3: Front Bottom Right
    (-1, 1, 1),   # Vertex 4: Front Top Left
    (-1, -1, -1), # Vertex 5: Back Bottom Left
    (-1, -1, 1),  # Vertex 6: Front Bottom Left
    (-1, 1, -1)   # Vertex 7: Back Top Left
)

# -----------------------------------------------------------------------------
# Step 15: Define Cube Edges Connecting Pairs of Vertices (12 edges)
# Connect the pairs of vertices using GL_LINES:
# Edge A: (0, 1)    Edge E: (4, 7)    Edge I: (3, 6)
# Edge B: (1, 2)    Edge F: (7, 5)    Edge J: (0, 4)
# Edge C: (2, 3)    Edge G: (5, 6)    Edge K: (2, 5)
# Edge D: (3, 0)    Edge H: (6, 4)    Edge L: (1, 7)
# -----------------------------------------------------------------------------
edges = (
    (0, 1),  # Edge A
    (1, 2),  # Edge B
    (2, 3),  # Edge C
    (3, 0),  # Edge D
    (4, 7),  # Edge E
    (7, 5),  # Edge F
    (5, 6),  # Edge G
    (6, 4),  # Edge H
    (3, 6),  # Edge I
    (0, 4),  # Edge J
    (2, 5),  # Edge K
    (1, 7)   # Edge L
)


def draw_cube():
    """
    Renders the wireframe cube by iterating over each defined edge
    and submitting its constituent vertices to OpenGL via GL_LINES.
    """
    glBegin(GL_LINES)
    # Optional crisp white wireframe coloring
    glColor3f(1.0, 1.0, 1.0)
    for edge in edges:
        for vertex in edge:
            glVertex3fv(vertices[vertex])
    glEnd()


def main():
    # Step 7: Initialize all Pygame submodules
    pygame.init()

    # Step 8: Set up display dimensions with double buffering and OpenGL context
    display = (800, 600)
    pygame.display.set_mode(display, DOUBLEBUF | OPENGL)

    # Step 9: Set window caption with assignment code and student full name
    pygame.display.set_caption("03 Lab 1 - Godwyn Neri")

    # Step 10: Configure viewing perspective and world translation
    # gluPerspective(fovy, aspect, zNear, zFar)
    gluPerspective(45, (display[0] / display[1]), 0.1, 50.0)
    # Move viewer back along the negative Z-axis to position the cube in view
    glTranslatef(0.0, 0.0, -5.0)

    # Enable depth testing to ensure correct spatial rendering
    glEnable(GL_DEPTH_TEST)

    # Step 11 & 16: Main event and rendering loop
    running = True
    while running:
        # Event handling: Process QUIT and Escape key events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False

        # Step 16: Rotate the cube continuously by 1 degree across vector (1, 1, 1)
        # Called before glClear() as specified in Step 16 of the laboratory manual
        glRotatef(1, 1, 1, 1)

        # Clear both color and depth buffers for the new frame
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        # Step 17: Render the wireframe cube
        draw_cube()

        # Swap the back buffer to the active display (Double Buffering)
        pygame.display.flip()

        # Pause briefly to regulate frame timing (~60 FPS)
        pygame.time.wait(15)

    # Clean shutdown
    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
