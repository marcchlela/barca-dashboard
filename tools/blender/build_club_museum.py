"""Build the Club museum's architectural shell and five fallback stop renders.

Run with Blender 4.5: blender -b -t 4 --python tools/blender/build_club_museum.py
The GLB contains architecture only; trophies are separate streamed exhibits.
"""

from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models" / "club"
IMAGES = ROOT / "public" / "images" / "club" / "museum"
SOURCE = ROOT / "assets" / "source" / "club-museum.blend"
for path in (OUT, IMAGES, SOURCE.parent):
    path.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(name, rgb, metallic=0, roughness=.5, emission=None, alpha=1):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, alpha)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 2.3
    if alpha < 1:
        material.surface_render_method = "DITHERED"
    return material

stone = mat("Charcoal honed stone", (.018, .026, .04), roughness=.75)
stone_light = mat("Cut stone edge", (.065, .075, .095), roughness=.68)
steel = mat("Blackened brushed steel", (.044, .055, .07), metallic=.8, roughness=.31)
blue = mat("Barca blue recessed lighting", (.004, .105, .42), emission=(.012, .14, .55))
garnet = mat("Garnet recessed lighting", (.34, .005, .075), emission=(.5, .012, .1))
gold = mat("Warm brass exhibit details", (.52, .33, .09), metallic=.75, roughness=.27)
glass = mat("Low tint glass", (.16, .25, .32), metallic=.12, roughness=.1, alpha=.13)

def cube(name, loc, scale, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Machined edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj

def cylinder(name, loc, radius, depth, material, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    modifier = obj.modifiers.new("Chamfer", "BEVEL")
    modifier.width = .025
    modifier.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj

# A continuous walkable hall. Longitudinal joints and paired rails give scale
# without depending on expensive screen-space reflections or shadows.
cube("stone floor", (0, 19, -.12), (11.8, 52, .25), stone)
cube("stone ceiling", (0, 19, 5.9), (11.8, 52, .2), stone)
for side in (-1, 1):
    cube(f"side wall {side}", (side * 5.8, 19, 2.9), (.22, 52, 5.9), stone)
    cube(f"upper steel beam {side}", (side * 5.23, 19, 5.2), (.18, 52, .25), steel)
    cube(f"blue floor rail {side}", (side * 4.36, 19, .028), (.045, 52, .03), blue)
    cube(f"garnet ceiling rail {side}", (side * 4.36, 19, 5.72), (.06, 52, .05), garnet)
for y in range(-5, 45, 2):
    cube(f"floor joint {y}", (0, y, .018), (10.7, .018, .018), steel)
    for side in (-1, 1):
        cube(f"column {side} {y}", (side * 5.14, y, 2.75), (.32, .3, 5.4), stone_light)

for index in range(5):
    y = 4 + index * 8
    # A low, open gallery case: transparent front and back, brass frame,
    # circular plinth, tall architectural portal and wall lighting.
    cube(f"portal lintel {index}", (0, y, 4.67), (8.5, .43, .35), steel)
    for side in (-1, 1):
        cube(f"portal jamb {index} {side}", (side * 4.15, y, 2.43), (.32, .43, 4.5), steel)
        cube(f"portal light {index} {side}", (side * 4.0, y - .31, 2.4), (.032, .045, 3.8), blue if index % 2 == 0 else garnet)
    cube(f"display alcove {index}", (0, y + 1.45, 2.42), (5.8, .18, 4.8), stone_light)
    cube(f"alcove dark inset {index}", (0, y + 1.34, 2.35), (5.25, .06, 4.25), stone)
    cylinder(f"plinth base {index}", (0, y, .19), 1.52, .39, steel)
    cylinder(f"plinth brass reveal {index}", (0, y, .43), 1.44, .085, gold)
    cylinder(f"plinth top {index}", (0, y, .52), 1.39, .1, stone_light)
    for side in (-1, 1):
        cube(f"glass edge {index} {side}", (side * 1.69, y - .54, 2.08), (.055, .08, 3.15), gold)
    cube(f"glass canopy {index}", (0, y - .54, 3.68), (3.45, .08, .065), gold)
    cube(f"glass front {index}", (0, y - .54, 2.06), (3.36, .027, 3.1), glass)
    cube(f"case inscription bar {index}", (0, y - 1.72, .045), (2.8, .055, .025), gold)

cube("archive wall", (0, 43.1, 2.9), (10.3, .27, 5.55), stone_light)
for row in range(4):
    cube(f"archive horizontal {row}", (0, 42.88, .72 + row * 1.18), (8.8, .05, .028), gold)
for col in range(5):
    cube(f"archive upright {col}", (-4.4 + col * 2.2, 42.88, 2.49), (.028, .05, 4.65), steel)

for index in range(5):
    y = 4 + index * 8
    marker = bpy.data.objects.new(f"CAMERA_STOP_{index + 1:02d}", None)
    bpy.context.scene.collection.objects.link(marker)
    marker.location = (math.sin(index * .52) * .42, y - 6.1, 2.32)
    marker.rotation_euler = (Vector((0, y, 1.75)) - marker.location).to_track_quat("-Z", "Y").to_euler()
    case_marker = bpy.data.objects.new(f"CASE_CENTRE_{index + 1:02d}", None)
    bpy.context.scene.collection.objects.link(case_marker)
    case_marker.location = (0, y, 1.75)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(OUT / "museum-room.glb"), export_format="GLB", export_apply=True, export_lights=False, export_cameras=False)
if "--geometry-only" in sys.argv:
    print("Museum shell and camera stops exported without rerendering stills")
    raise SystemExit(0)

# Each static stop is rendered from the same authored path used in React. The
# separately loaded trophy/photo remains visible over the room in fallback UI.
world = bpy.context.scene.world
world.color = (.035, .045, .07)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.035, .045, .07, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = .38

def area(name, location, target, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("Museum walk camera")
camera = bpy.data.objects.new("Museum walk camera", camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.lens = 34
bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.context.scene.render.resolution_x = 1400
bpy.context.scene.render.resolution_y = 880
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "WEBP"
bpy.context.scene.render.image_settings.quality = 82
bpy.context.scene.render.film_transparent = False
for index in range(5):
    y = 4 + index * 8
    area(f"warm case {index}", (0, y - .8, 4.4), (0, y, 1.85), 650, (1, .72, .4), 3.8)
    camera.location = (math.sin(index * .52) * .42, y - 6.1, 2.32)
    camera.rotation_euler = (Vector((0, y, 1.75)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.render.filepath = str(IMAGES / f"stop-{index + 1}.webp")
    bpy.ops.render.render(write_still=True)
print("Museum architecture, Blender source and five stop renders exported")
