"""Build the deterministic graybox for the Barça dashboard tunnel intro.

Run with:
  "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" \
    --background --python tools/blender/build_tunnel_blockout.py

The script saves an editable .blend source file and exports a compact GLB.
The reconstruction is intentionally approximate: it proves composition,
camera travel, modularity, and the dashboard handoff rather than real-world
dimensions or final finishes.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = REPO_ROOT / "assets" / "source" / "camp-nou-tunnel-blockout.blend"
GLB_PATH = REPO_ROOT / "public" / "models" / "camp-nou-tunnel-blockout.glb"

FPS = 30
END_FRAME = 105


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.72,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = color

    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Alpha"].default_value = color[3]

    if emission is not None:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength

    if color[3] < 1.0:
        material.use_transparency_overlap = False
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"

    return material


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Blockout_Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 1

    obj.data.materials.append(material)
    return obj


def add_ramp(
    name: str,
    *,
    width: float,
    y_start: float,
    y_end: float,
    z_start: float,
    z_end: float,
    thickness: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    half_width = width / 2.0
    vertices = [
        (-half_width, y_start, z_start),
        (half_width, y_start, z_start),
        (-half_width, y_end, z_end),
        (half_width, y_end, z_end),
        (-half_width, y_start, z_start - thickness),
        (half_width, y_start, z_start - thickness),
        (-half_width, y_end, z_end - thickness),
        (half_width, y_end, z_end - thickness),
    ]
    faces = [
        (0, 2, 3, 1),
        (4, 5, 7, 6),
        (0, 1, 5, 4),
        (2, 6, 7, 3),
        (0, 4, 6, 2),
        (1, 3, 7, 5),
    ]

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_rail(
    name: str,
    *,
    x: float,
    y_start: float,
    y_end: float,
    z_start: float,
    z_end: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = 0.045
    curve_data.bevel_resolution = 2

    spline = curve_data.splines.new(type="POLY")
    spline.points.add(2)
    midpoint_y = (y_start + y_end) / 2.0
    midpoint_z = (z_start + z_end) / 2.0
    points = (
        (x, y_start, z_start, 1.0),
        (x, midpoint_y, midpoint_z, 1.0),
        (x, y_end, z_end, 1.0),
    )

    for point, coordinate in zip(spline.points, points):
        point.co = coordinate

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_camera_path(points: list[tuple[float, float, float]]) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name="Camera_Path_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 12

    spline = curve_data.splines.new(type="BEZIER")
    spline.bezier_points.add(len(points) - 1)

    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"

    obj = bpy.data.objects.new("Camera_Path", curve_data)
    bpy.context.collection.objects.link(obj)
    obj.hide_render = True
    obj["purpose"] = "Reference spline for the normalized 0-to-1 web camera path"
    return obj


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera_animation() -> None:
    camera_data = bpy.data.cameras.new("Tunnel_Camera_Data")
    camera_data.lens = 31.0
    camera_data.sensor_width = 36.0
    camera_data.clip_start = 0.05
    camera_data.clip_end = 120.0

    camera = bpy.data.objects.new("Tunnel_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    samples = (
        (1, Vector((0.0, -10.6, 1.67)), Vector((0.0, -2.0, 1.62))),
        (18, Vector((0.0, -8.0, 1.67)), Vector((0.0, 0.0, 1.63))),
        (45, Vector((-0.08, -2.6, 1.68)), Vector((0.0, 5.5, 1.68))),
        (75, Vector((0.04, 4.4, 1.76)), Vector((0.0, 10.8, 1.86))),
        (96, Vector((0.0, 9.1, 1.96)), Vector((0.0, 15.5, 2.0))),
        (105, Vector((0.0, 11.0, 2.05)), Vector((0.0, 18.0, 2.0))),
    )

    for frame, location, target in samples:
        camera.location = location
        point_camera(camera, target)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)

    if camera.animation_data and camera.animation_data.action:
        for fcurve in camera.animation_data.action.fcurves:
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = "BEZIER"


def build_scene() -> None:
    reset_scene()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = END_FRAME
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["blockout_version"] = "threshold-v1"
    scene["architecture_note"] = "Plausible artistic reconstruction; dimensions are not factual."

    world = bpy.data.worlds.new("Blockout_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.008,
        0.012,
        0.02,
        1.0,
    )
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28
    scene.world = world

    shell = make_material("MAT_Tunnel_DeepGray", (0.025, 0.04, 0.065, 1.0), roughness=0.82)
    structure = make_material("MAT_Structure_Gray", (0.13, 0.15, 0.18, 1.0), roughness=0.7)
    rail = make_material(
        "MAT_Rail_MediumGray",
        (0.28, 0.31, 0.34, 1.0),
        metallic=0.75,
        roughness=0.34,
    )
    glass = make_material("MAT_Glass_Blockout", (0.16, 0.2, 0.23, 0.26), roughness=0.22)
    floor = make_material("MAT_Floor_NeutralGray", (0.1, 0.11, 0.125, 1.0), roughness=0.9)
    turf = make_material("MAT_Turf_Subdued", (0.035, 0.12, 0.075, 1.0), roughness=0.95)
    line = make_material("MAT_Pitch_Line", (0.46, 0.5, 0.51, 1.0), roughness=0.78)
    light = make_material(
        "MAT_Ceiling_Light",
        (0.34, 0.36, 0.35, 1.0),
        roughness=0.52,
        emission=(0.46, 0.48, 0.46),
        emission_strength=0.48,
    )
    bowl = make_material("MAT_Bowl_Gray", (0.16, 0.17, 0.18, 1.0), roughness=0.88)

    # Main tunnel shell: approximately 7 m clear width, 4.3 m clear height.
    add_box("Tunnel_Wall_Left", (-3.62, -0.5, 2.15), (0.24, 23.0, 4.3), shell)
    add_box("Tunnel_Wall_Right_Back", (5.25, -0.5, 2.15), (0.22, 23.0, 4.3), shell)
    add_box("Tunnel_Ceiling", (0.8, -0.5, 4.42), (8.95, 23.0, 0.24), shell)
    add_box("Tunnel_Floor_Main", (0.0, -3.25, -0.1), (7.0, 16.5, 0.2), floor)

    # Lateral glazing on the right, with a low base and modular structural bays.
    add_box("Glass_Base_Wall", (3.54, -1.2, 0.38), (0.18, 18.6, 0.76), structure)
    bay_centers = (-8.6, -5.6, -2.6, 0.4, 3.4, 6.4)
    for index, y in enumerate(bay_centers, start=1):
        add_box(
            f"GlassBay_{index:02d}",
            (3.50, y, 2.28),
            (0.075, 2.72, 2.92),
            glass,
        )
        add_box(
            f"GlassMullion_{index:02d}",
            (3.46, y - 1.47, 2.28),
            (0.15, 0.13, 3.12),
            structure,
        )

    add_box("GlassMullion_End", (3.46, 7.87, 2.28), (0.15, 0.13, 3.12), structure)
    add_box("Glass_Head", (3.47, -0.35, 3.81), (0.17, 19.0, 0.18), structure)

    # A few left wall modules make the route feel architectural without detail work.
    for index, y in enumerate((-8.5, -3.5, 1.5, 6.5), start=1):
        add_box(
            f"WallModule_Left_{index:02d}",
            (-3.47, y, 2.15),
            (0.12, 0.18, 3.85),
            structure,
        )

    # Rails and simple vertical posts.
    add_rail(
        "Rail_Left",
        x=-2.95,
        y_start=-9.8,
        y_end=9.8,
        z_start=1.05,
        z_end=1.43,
        material=rail,
    )
    add_rail(
        "Rail_Right",
        x=2.95,
        y_start=-9.8,
        y_end=9.8,
        z_start=1.05,
        z_end=1.43,
        material=rail,
    )

    for side_name, x in (("Left", -2.95), ("Right", 2.95)):
        for index, y in enumerate((-9.5, -5.5, -1.5, 2.5, 6.5, 9.3), start=1):
            floor_z = 0.0 if y <= 5.0 else (y - 5.0) / 6.0 * 0.42
            add_box(
                f"RailPost_{side_name}_{index:02d}",
                (x, y, floor_z + 0.56),
                (0.07, 0.07, 1.12),
                rail,
            )

    # Rectangular light housings and emissive panels.
    for index, y in enumerate((-9.2, -5.5, -1.8, 1.9, 5.6, 8.7), start=1):
        add_box(
            f"CeilingLight_Housing_{index:02d}",
            (0.0, y, 4.18),
            (2.4, 0.72, 0.13),
            structure,
            bevel=0.035,
        )
        add_box(
            f"CeilingLight_Emitter_{index:02d}",
            (0.0, y, 4.09),
            (2.08, 0.46, 0.035),
            light,
        )

    # Gentle exit ramp and portal.
    add_ramp(
        "Tunnel_Exit_Ramp",
        width=7.0,
        y_start=5.0,
        y_end=11.2,
        z_start=0.0,
        z_end=0.42,
        thickness=0.2,
        material=floor,
    )
    add_box("ExitPortal_Left", (-3.52, 11.35, 2.25), (0.34, 0.62, 4.5), structure)
    add_box("ExitPortal_Right", (3.52, 11.35, 2.25), (0.34, 0.62, 4.5), structure)
    add_box("ExitPortal_Header", (0.0, 11.35, 4.22), (7.35, 0.62, 0.56), structure)
    add_box("Exit_Threshold", (0.0, 11.35, 0.45), (7.1, 0.6, 0.1), line)

    # Pitch patch and a center/tunnel line used by the web transition.
    add_box("Pitch_Turf", (0.0, 20.0, 0.34), (22.0, 17.2, 0.16), turf)
    add_box("Pitch_Center_Lead", (0.0, 17.3, 0.435), (0.075, 11.5, 0.018), line)
    add_box("Pitch_Touchline", (0.0, 12.4, 0.435), (15.5, 0.075, 0.018), line)

    # Only fragments visible through the portal; this is intentionally not a stadium model.
    for row in range(5):
        add_box(
            f"Bowl_Far_Row_{row + 1:02d}",
            (0.0, 29.4 + row * 0.72, 0.7 + row * 0.46),
            (25.0 - row * 0.5, 0.68, 0.42),
            bowl,
        )

    for side_name, x_sign in (("Left", -1.0), ("Right", 1.0)):
        for row in range(4):
            add_box(
                f"Bowl_{side_name}_Row_{row + 1:02d}",
                (x_sign * (11.4 + row * 0.4), 21.5, 0.75 + row * 0.48),
                (0.65, 13.0 - row * 0.45, 0.42),
                bowl,
            )

    # A large, soft exit light is useful in Blender inspection and exports as a punctual light.
    light_data = bpy.data.lights.new(name="Exit_Daylight_Data", type="AREA")
    light_data.energy = 1300.0
    light_data.shape = "RECTANGLE"
    light_data.size = 8.0
    light_data.size_y = 4.0
    exit_light = bpy.data.objects.new("Exit_Daylight", light_data)
    exit_light.location = (0.0, 13.5, 5.5)
    exit_light.rotation_euler = (math.radians(68.0), 0.0, math.radians(180.0))
    bpy.context.collection.objects.link(exit_light)

    path_points = [
        (0.0, -10.6, 1.67),
        (0.0, -7.8, 1.67),
        (-0.08, -2.4, 1.68),
        (0.04, 4.4, 1.76),
        (0.0, 9.1, 1.96),
        (0.0, 11.0, 2.05),
    ]
    add_camera_path(path_points)
    add_camera_animation()


def save_and_export() -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_cameras=True,
        export_lights=True,
        export_yup=True,
        export_apply=True,
    )

    print(f"BLOCKOUT_BLEND={BLEND_PATH}")
    print(f"BLOCKOUT_GLB={GLB_PATH}")
    print(f"BLOCKOUT_GLB_BYTES={GLB_PATH.stat().st_size}")


if __name__ == "__main__":
    build_scene()
    save_and_export()
