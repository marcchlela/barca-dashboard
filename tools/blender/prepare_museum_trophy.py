"""Normalise a supplied trophy to a 2.45 m high, centre-grounded GLB and proof image.

blender -b -t 4 --python tools/blender/prepare_museum_trophy.py -- SOURCE DESTINATION
"""
import sys
import math
from pathlib import Path
import bpy
from mathutils import Vector

source_name, destination_name = sys.argv[sys.argv.index("--") + 1:]
root = Path(__file__).resolve().parents[2]
source = (root / source_name).resolve()
destination = (root / destination_name).resolve()
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
if source.suffix.lower() == ".obj":
    bpy.ops.wm.obj_import(filepath=str(source))
    # The supplied Copa OBJ is laid on its side, with the base toward +Y.
    # Rotate -90 degrees about X so the base rests on the ground.
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.rotation_euler.x -= math.pi / 2
else:
    bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("No mesh in source")
if "champions-league-trophy" in source.name:
    for material in bpy.data.materials:
        if material.use_nodes:
            bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (.58, .62, .68, 1)
                bsdf.inputs["Metallic"].default_value = .62
                bsdf.inputs["Roughness"].default_value = .24
elif source.suffix.lower() == ".obj":
    silver = bpy.data.materials.new("Polished silver archive replica")
    silver.use_nodes = True
    bsdf = silver.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (.67, .71, .77, 1)
    bsdf.inputs["Metallic"].default_value = .48
    bsdf.inputs["Roughness"].default_value = .24
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(silver)
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minv = Vector(tuple(min(point[i] for point in points) for i in range(3)))
maxv = Vector(tuple(max(point[i] for point in points) for i in range(3)))
height = maxv.z - minv.z
if height <= 0:
    raise RuntimeError("Source model has no height on Z; inspect orientation")
scale = 2.45 / height
root_obj = bpy.data.objects.new("museum trophy", None)
bpy.context.scene.collection.objects.link(root_obj)
for obj in tuple(bpy.context.scene.objects):
    if obj != root_obj and obj.parent is None:
        obj.parent = root_obj
root_obj.scale = (scale,) * 3
root_obj.location = (-(minv.x + maxv.x) * scale / 2, -(minv.y + maxv.y) * scale / 2, -minv.z * scale)
bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB", export_apply=True, export_lights=False, export_cameras=False)

camera_data = bpy.data.cameras.new("proof camera")
camera = bpy.data.objects.new("proof camera", camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = (3.2, -5.2, 2.2)
camera.rotation_euler = (Vector((0, 0, 1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 3.8
bpy.context.scene.camera = camera
for name, location, energy in (("key", (2, -3, 5), 750), ("fill", (-3, 2, 4), 550)):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0, 0, 1.2)) - light.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.context.scene.render.resolution_x = 750
bpy.context.scene.render.resolution_y = 750
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.film_transparent = True
bpy.context.scene.render.filepath = str(destination.with_suffix(".proof.png"))
bpy.ops.render.render(write_still=True)
print(f"{source.name}: {len(meshes)} meshes, height {height:.3f}, scale {scale:.5f}")
