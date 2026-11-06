import bpy
import os
import math
from mathutils import Vector

# Remove default cube/light/camera.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Shared grey stone material.
mat = bpy.data.materials.new(name='golem_grey')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.55, 0.56, 0.58, 1.0)
bsdf.inputs['Roughness'].default_value = 0.85

def add_box(name, size, location, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    return obj

# --- Base body (always visible) ---
# Legs
add_box('base_legL',  (0.42, 0.55, 1.1), (-0.32, 0.0, 0.0), (0.05, 0, 0.05))
add_box('base_legR',  (0.42, 0.55, 1.1), (0.32, 0.0, 0.0), (-0.05, 0, -0.05))
add_box('base_footL', (0.5, 0.75, 0.35), (-0.32, 0.25, -0.45), (0.1, 0, 0))
add_box('base_footR', (0.5, 0.75, 0.35), (0.32, 0.25, -0.45), (-0.1, 0, 0))
add_box('base_hips', (0.85, 0.55, 0.45), (0.0, 0.0, 0.2))

# Torso
add_box('base_chest',  (0.95, 0.75, 0.65), (0.0, 0.85, 0.0), (0.08, 0, 0))
add_box('base_abs',    (0.75, 0.55, 0.55), (0.0, 0.45, 0.05), (0.04, 0, 0))
add_box('base_head', (0.45, 0.55, 0.45), (0.0, 1.55, 0.05), (0.05, 0, 0))

# Arms
add_box('base_shoulderL', (0.45, 0.7, 0.5), (-0.72, 1.15, 0.0), (0.0, 0, 0.25))
add_box('base_shoulderR', (0.45, 0.7, 0.5), (0.72, 1.15, 0.0), (0.0, 0, -0.25))
add_box('base_armL', (0.32, 0.85, 0.35), (-0.78, 0.55, 0.0), (0.15, 0, 0.15))
add_box('base_armR', (0.32, 0.85, 0.35), (0.78, 0.55, 0.0), (-0.15, 0, -0.15))
add_box('base_gauntletL', (0.4, 0.55, 0.45), (-0.78, 0.05, 0.05), (0.1, 0, 0.1))
add_box('base_gauntletR', (0.4, 0.55, 0.45), (0.78, 0.05, 0.05), (-0.1, 0, -0.1))

# --- Fire variant: horns and flame-shaped shoulder crests ---
add_box('fire_hornL', (0.1, 0.35, 0.12), (-0.14, 1.8, 0.0), (0.25, 0, -0.2))
add_box('fire_hornR', (0.1, 0.35, 0.12), (0.14, 1.8, 0.0), (-0.25, 0, 0.2))
add_box('fire_crestL', (0.25, 0.7, 0.15), (-0.85, 1.4, 0.0), (0.0, 0, 0.35))
add_box('fire_crestR', (0.25, 0.7, 0.15), (0.85, 1.4, 0.0), (0.0, 0, -0.35))

# --- Water variant: curved fin-like shoulder pieces and crest ---
add_box('water_finL', (0.15, 0.9, 0.55), (-0.85, 1.2, 0.0), (0.0, 0, 0.55))
add_box('water_finR', (0.15, 0.9, 0.55), (0.85, 1.2, 0.0), (0.0, 0, -0.55))
add_box('water_crest', (0.45, 0.2, 0.15), (0.0, 1.85, 0.0), (0.0, 0, 0))

# --- Earth variant: bulky crystal spikes on shoulders and back ---
add_box('earth_spikeL', (0.25, 0.55, 0.25), (-0.95, 1.25, 0.0), (0.0, 0, 0.6))
add_box('earth_spikeR', (0.25, 0.55, 0.25), (0.95, 1.25, 0.0), (0.0, 0, -0.6))
add_box('earth_backSpike', (0.2, 0.5, 0.35), (0.0, 1.05, -0.55), (0.6, 0, 0))

# Select all the golem parts and rotate the whole character so it faces +Z after export.
bpy.ops.object.select_all(action='SELECT')
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.transform.rotate(value=math.pi, orient_axis='Z', center_override=(0, 0, 0))

# Offset everything down so the lowest point of the model sits at z = 0 (the floor).
bpy.ops.object.select_all(action='SELECT')
min_z = float('inf')
for obj in bpy.context.selected_objects:
    if obj.type != 'MESH':
        continue
    for corner in obj.bound_box:
        world_z = (obj.matrix_world @ Vector(corner)).z
        if world_z < min_z:
            min_z = world_z
print('Lowest point before floor offset:', min_z)
if min_z < 0:
    bpy.ops.transform.translate(value=(0, 0, -min_z))

out_path = os.path.join(os.getcwd(), 'assets', 'golem.glb')
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB')
print('Exported golem to', out_path)
