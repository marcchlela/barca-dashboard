"""Normalize a sourced GLTF trophy into the Club viewer's metre-scale GLB."""

import sys
from pathlib import Path

import bpy
from mathutils import Vector


source, destination = sys.argv[sys.argv.index("--") + 1 :]
repository = Path(__file__).resolve().parents[2]
source = str((repository / source).resolve())
destination = str((repository / destination).resolve())
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("Source asset contains no mesh")

bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
height = maximum.z - minimum.z
if height <= 0:
    raise RuntimeError("Source asset has no height")

scale = 2.9 / height
centre_x = (minimum.x + maximum.x) / 2
centre_y = (minimum.y + maximum.y) / 2
root = bpy.data.objects.new("Museum trophy", None)
bpy.context.scene.collection.objects.link(root)
for obj in [obj for obj in bpy.context.scene.objects if obj.parent is None and obj != root]:
    obj.parent = root
root.scale = (scale, scale, scale)
root.location = (-centre_x * scale, -centre_y * scale, -minimum.z * scale)

for material in bpy.data.materials:
    if material.use_nodes:
        principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if principled:
            principled.inputs["Metallic"].default_value = 0.9
            principled.inputs["Roughness"].default_value = 0.24

bpy.ops.export_scene.gltf(filepath=destination, export_format="GLB", export_apply=True)

# A small proof render makes it possible to catch a mislabeled or poorly framed mesh.
camera_data = bpy.data.cameras.new("Proof camera")
camera = bpy.data.objects.new("Proof camera", camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = (4.5, -5.8, 3.6)
target = Vector((0, 0, 1.4))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 4.3
bpy.context.scene.camera = camera
for name, location, energy in (("Key", (2, -4, 6), 1100), ("Fill", (-3, 2, 4), 850)):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.render.engine = "CYCLES"
bpy.context.scene.cycles.samples = 24
bpy.context.scene.render.resolution_x = 700
bpy.context.scene.render.resolution_y = 700
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.world.color = (0.03, 0.04, 0.07)
bpy.context.scene.render.filepath = destination.replace(".glb", "-proof.png")
bpy.ops.render.render(write_still=True)
print(f"Exported {len(meshes)} mesh(es), source height {height:.3f}, scale {scale:.3f}")
