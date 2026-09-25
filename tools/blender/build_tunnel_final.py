"""Build the production FC Barcelona tunnel intro scene.

Run with:
  "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" \\
    --background --python tools/blender/build_tunnel_final.py

The scene is an original, plausible interpretation made for the dashboard.
It does not claim to reproduce restricted areas of Spotify Camp Nou exactly.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = REPO_ROOT / "assets" / "source" / "camp-nou-tunnel-final.blend"
GLB_PATH = REPO_ROOT / "public" / "models" / "camp-nou-tunnel-final.glb"
MURAL_PATH = REPO_ROOT / "assets" / "source" / "textures" / "intro" / "blaugrana-mural.png"
CREST_PATH = REPO_ROOT / "public" / "textures" / "intro" / "fc-barcelona-crest.png"

FPS = 30
END_FRAME = 135


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.62,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    coat: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = color

    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Alpha"].default_value = color[3]

    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
        principled.inputs["Coat Roughness"].default_value = max(0.12, roughness * 0.5)

    if emission is not None:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength

    if color[3] < 1.0:
        material.use_transparency_overlap = False
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"

    return material


def make_texture_material(
    name: str,
    image_path: Path,
    *,
    roughness: float,
    metallic: float = 0.0,
    alpha: bool = False,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.pack()

    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = f"{name}_Image"
    texture.image = image
    texture.interpolation = "Linear"
    texture.extension = "EXTEND"

    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic

    if emission_strength > 0.0:
        links.new(texture.outputs["Color"], principled.inputs["Emission Color"])
        principled.inputs["Emission Strength"].default_value = emission_strength

    if alpha:
        links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
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
    bevel_segments: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments

    obj.data.materials.append(material)
    return obj


def add_plane_yz(
    name: str,
    *,
    x: float,
    y_start: float,
    y_end: float,
    z_start: float,
    z_end: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    vertices = [
        (x, y_start, z_start),
        (x, y_end, z_start),
        (x, y_end, z_end),
        (x, y_start, z_end),
    ]
    faces = [(0, 1, 2, 3)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_values = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    for loop, uv in zip(mesh.loops, uv_values):
        uv_layer.data[loop.index].uv = uv

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_plane_xz(
    name: str,
    *,
    y: float,
    x_start: float,
    x_end: float,
    z_start: float,
    z_end: float,
    material: bpy.types.Material,
    uv_v_start: float = 0.0,
    uv_v_end: float = 1.0,
) -> bpy.types.Object:
    vertices = [
        (x_start, y, z_start),
        (x_end, y, z_start),
        (x_end, y, z_end),
        (x_start, y, z_end),
    ]
    faces = [(0, 1, 2, 3)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_values = (
        (0.0, uv_v_start),
        (1.0, uv_v_start),
        (1.0, uv_v_end),
        (0.0, uv_v_end),
    )
    for loop, uv in zip(mesh.loops, uv_values):
        uv_layer.data[loop.index].uv = uv

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
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
    curve_data.bevel_depth = 0.038
    curve_data.bevel_resolution = 3

    spline = curve_data.splines.new(type="POLY")
    spline.points.add(2)
    midpoint_y = (y_start + y_end) / 2.0
    midpoint_z = (z_start + z_end) / 2.0
    for point, coordinate in zip(
        spline.points,
        (
            (x, y_start, z_start, 1.0),
            (x, midpoint_y, midpoint_z, 1.0),
            (x, y_end, z_end, 1.0),
        ),
    ):
        point.co = coordinate

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_text(
    name: str,
    body: str,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    size: float,
    extrude: float,
    spacing: float = 1.0,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_Curve", type="FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = min(0.008, extrude * 0.35)
    curve.bevel_resolution = 2
    curve.space_character = spacing

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.radians(90.0), 0.0, 0.0)
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
    obj["purpose"] = "Reference spline for the normalized web camera path"
    return obj


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera_animation() -> None:
    camera_data = bpy.data.cameras.new("Tunnel_Camera_Data")
    camera_data.lens = 31.0
    camera_data.sensor_width = 36.0
    camera_data.clip_start = 0.05
    camera_data.clip_end = 140.0
    camera = bpy.data.objects.new("Tunnel_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    samples = (
        (1, Vector((0.0, -10.8, 1.68)), Vector((0.0, -2.0, 1.66))),
        (28, Vector((0.0, -8.2, 1.68)), Vector((0.0, 0.0, 1.66))),
        (64, Vector((-0.06, -2.8, 1.70)), Vector((0.0, 5.0, 1.73))),
        (102, Vector((0.03, 4.3, 1.78)), Vector((0.0, 10.8, 1.92))),
        (126, Vector((0.0, 9.2, 2.00)), Vector((0.0, 15.7, 2.08))),
        (135, Vector((0.0, 11.05, 2.08)), Vector((0.0, 19.0, 2.06))),
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


def angle_from_near_side(angle: float) -> float:
    """Return the signed angular distance from the bowl's near-side midpoint."""
    return math.atan2(
        math.sin(angle + math.pi / 2.0),
        math.cos(angle + math.pi / 2.0),
    )


def add_elliptical_tier(
    name: str,
    *,
    center_y: float,
    base_rx: float,
    base_ry: float,
    base_z: float,
    rows: int,
    row_depth: float,
    row_rise: float,
    materials: tuple[
        bpy.types.Material,
        bpy.types.Material,
        bpy.types.Material,
        bpy.types.Material,
    ],
    opening_degrees: float = 10.5,
    segments: int = 112,
    pattern_offset: int = 0,
) -> bpy.types.Object:
    """Create a compact stepped Camp Nou-style seating tier with a tunnel gap."""
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    material_indices: list[int] = []
    opening = math.radians(opening_degrees)

    def add_quad(
        points: tuple[
            tuple[float, float, float],
            tuple[float, float, float],
            tuple[float, float, float],
            tuple[float, float, float],
        ],
        material_index: int,
    ) -> None:
        start = len(vertices)
        vertices.extend(points)
        faces.append((start, start + 1, start + 2, start + 3))
        material_indices.append(material_index)

    for row in range(rows):
        inner_rx = base_rx + row * row_depth
        inner_ry = base_ry + row * row_depth * 0.73
        outer_rx = inner_rx + row_depth
        outer_ry = inner_ry + row_depth * 0.73
        tread_z = base_z + row * row_rise

        for segment in range(segments):
            angle_0 = 2.0 * math.pi * segment / segments
            angle_1 = 2.0 * math.pi * (segment + 1) / segments
            midpoint = (angle_0 + angle_1) / 2.0
            if abs(angle_from_near_side(midpoint)) < opening:
                continue

            inner_0 = (
                inner_rx * math.cos(angle_0),
                center_y + inner_ry * math.sin(angle_0),
                tread_z,
            )
            inner_1 = (
                inner_rx * math.cos(angle_1),
                center_y + inner_ry * math.sin(angle_1),
                tread_z,
            )
            outer_0 = (
                outer_rx * math.cos(angle_0),
                center_y + outer_ry * math.sin(angle_0),
                tread_z,
            )
            outer_1 = (
                outer_rx * math.cos(angle_1),
                center_y + outer_ry * math.sin(angle_1),
                tread_z,
            )

            section = (segment // 7 + row // 4 + pattern_offset) % 5
            seat_material = 0 if section in (0, 1, 3) else 1
            if segment % 16 in (0, 1):
                seat_material = 2
            elif segment % 28 == 14:
                seat_material = 3

            add_quad((inner_0, outer_0, outer_1, inner_1), seat_material)

            riser_bottom_0 = (inner_0[0], inner_0[1], tread_z - row_rise)
            riser_bottom_1 = (inner_1[0], inner_1[1], tread_z - row_rise)
            add_quad((riser_bottom_1, riser_bottom_0, inner_0, inner_1), seat_material)

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for material in materials:
        obj.data.materials.append(material)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index
    return obj


def add_elliptical_wall(
    name: str,
    *,
    center_y: float,
    radius_x: float,
    radius_y: float,
    z_bottom: float,
    z_top: float,
    material: bpy.types.Material,
    opening_degrees: float = 10.5,
    segments: int = 112,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    opening = math.radians(opening_degrees)

    for segment in range(segments):
        angle_0 = 2.0 * math.pi * segment / segments
        angle_1 = 2.0 * math.pi * (segment + 1) / segments
        midpoint = (angle_0 + angle_1) / 2.0
        if abs(angle_from_near_side(midpoint)) < opening:
            continue
        start = len(vertices)
        vertices.extend(
            (
                (
                    radius_x * math.cos(angle_0),
                    center_y + radius_y * math.sin(angle_0),
                    z_bottom,
                ),
                (
                    radius_x * math.cos(angle_1),
                    center_y + radius_y * math.sin(angle_1),
                    z_bottom,
                ),
                (
                    radius_x * math.cos(angle_1),
                    center_y + radius_y * math.sin(angle_1),
                    z_top,
                ),
                (
                    radius_x * math.cos(angle_0),
                    center_y + radius_y * math.sin(angle_0),
                    z_top,
                ),
            )
        )
        faces.append((start, start + 1, start + 2, start + 3))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_pitch_circle(
    name: str,
    *,
    center: tuple[float, float],
    radius: float,
    z: float,
    material: bpy.types.Material,
    segments: int = 64,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = 0.045
    curve_data.bevel_resolution = 1
    spline = curve_data.splines.new(type="POLY")
    spline.points.add(segments - 1)
    for index, point in enumerate(spline.points):
        angle = 2.0 * math.pi * index / segments
        point.co = (
            center[0] + radius * math.cos(angle),
            center[1] + radius * math.sin(angle),
            z,
            1.0,
        )
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_goal(
    name: str,
    *,
    x: float,
    outward: float,
    center_y: float,
    material: bpy.types.Material,
) -> None:
    ground_z = 0.49
    goal_width = 4.55
    goal_height = 1.52
    goal_depth = 1.28
    post = 0.11
    back_x = x + outward * goal_depth

    for side, y in (("Left", center_y - goal_width / 2.0), ("Right", center_y + goal_width / 2.0)):
        add_box(
            f"{name}_{side}_Post",
            (x, y, ground_z + goal_height / 2.0),
            (post, post, goal_height),
            material,
        )
        add_box(
            f"{name}_{side}_Depth",
            ((x + back_x) / 2.0, y, ground_z + goal_height),
            (goal_depth, post * 0.72, post * 0.72),
            material,
        )
    add_box(
        f"{name}_Crossbar",
        (x, center_y, ground_z + goal_height),
        (post, goal_width + post, post),
        material,
    )
    add_box(
        f"{name}_Backbar",
        (back_x, center_y, ground_z + goal_height),
        (post * 0.72, goal_width + post, post * 0.72),
        material,
    )


def add_stadium_reveal(materials: dict[str, bpy.types.Material]) -> None:
    """Build an original optimized three-tier interpretation of Camp Nou."""
    turf = materials["turf"]
    turf_light = materials["turf_light"]
    line = materials["line"]
    concrete = materials["concrete"]
    seat_blue = materials["seat_blue"]
    seat_claret = materials["seat_claret"]
    gold = materials["gold"]
    dark = materials["dark"]
    metal = materials["metal"]

    pitch_center_y = 34.0
    pitch_length = 65.1
    pitch_width = 42.15
    pitch_top = 0.48
    half_length = pitch_length / 2.0
    half_width = pitch_width / 2.0

    add_box(
        "Camp_Nou_Pitch_Base",
        (0.0, pitch_center_y, 0.38),
        (pitch_length + 1.2, pitch_width + 1.2, 0.20),
        turf,
    )
    stripe_width = pitch_length / 12.0
    for stripe in range(12):
        add_box(
            f"Pitch_Mowing_Stripe_{stripe + 1:02d}",
            (-half_length + stripe_width * (stripe + 0.5), pitch_center_y, pitch_top + 0.006),
            (stripe_width + 0.015, pitch_width, 0.012),
            turf_light if stripe % 2 == 0 else turf,
        )

    # Touchlines, goal lines, halfway line, centre spot, and regulation-style boxes.
    for side, y in (("Near", pitch_center_y - half_width), ("Far", pitch_center_y + half_width)):
        add_box(f"Pitch_{side}_Touchline", (0.0, y, pitch_top + 0.025), (pitch_length, 0.075, 0.026), line)
    for side, x in (("Left", -half_length), ("Right", half_length)):
        add_box(f"Pitch_{side}_Goal_Line", (x, pitch_center_y, pitch_top + 0.025), (0.075, pitch_width, 0.026), line)
    add_box("Pitch_Halfway_Line", (0.0, pitch_center_y, pitch_top + 0.025), (0.075, pitch_width, 0.026), line)
    add_pitch_circle(
        "Pitch_Centre_Circle",
        center=(0.0, pitch_center_y),
        radius=5.68,
        z=pitch_top + 0.045,
        material=line,
    )
    add_box("Pitch_Centre_Spot", (0.0, pitch_center_y, pitch_top + 0.038), (0.18, 0.18, 0.035), line)

    penalty_depth = 10.25
    penalty_half_width = 12.48
    goal_box_depth = 3.42
    goal_box_half_width = 5.68
    for side, sign in (("Left", -1.0), ("Right", 1.0)):
        penalty_edge = sign * (half_length - penalty_depth)
        goal_box_edge = sign * (half_length - goal_box_depth)
        add_box(
            f"{side}_Penalty_Front",
            (penalty_edge, pitch_center_y, pitch_top + 0.025),
            (0.075, penalty_half_width * 2.0, 0.026),
            line,
        )
        for edge_name, y in (("Low", pitch_center_y - penalty_half_width), ("High", pitch_center_y + penalty_half_width)):
            add_box(
                f"{side}_Penalty_{edge_name}",
                (sign * (half_length - penalty_depth / 2.0), y, pitch_top + 0.025),
                (penalty_depth, 0.075, 0.026),
                line,
            )
        add_box(
            f"{side}_Goal_Box_Front",
            (goal_box_edge, pitch_center_y, pitch_top + 0.025),
            (0.075, goal_box_half_width * 2.0, 0.026),
            line,
        )
        for edge_name, y in (("Low", pitch_center_y - goal_box_half_width), ("High", pitch_center_y + goal_box_half_width)):
            add_box(
                f"{side}_Goal_Box_{edge_name}",
                (sign * (half_length - goal_box_depth / 2.0), y, pitch_top + 0.025),
                (goal_box_depth, 0.075, 0.026),
                line,
            )

    add_goal("Left_Goal", x=-half_length - 0.08, outward=-1.0, center_y=pitch_center_y, material=line)
    add_goal("Right_Goal", x=half_length + 0.08, outward=1.0, center_y=pitch_center_y, material=line)

    tier_materials = (seat_blue, seat_claret, concrete, gold)
    add_elliptical_tier(
        "Camp_Nou_Lower_Tier",
        center_y=pitch_center_y,
        base_rx=34.1,
        base_ry=23.0,
        base_z=0.72,
        rows=14,
        row_depth=0.72,
        row_rise=0.25,
        materials=tier_materials,
    )
    add_elliptical_wall(
        "Lower_Tier_Fascia",
        center_y=pitch_center_y,
        radius_x=44.4,
        radius_y=30.55,
        z_bottom=3.95,
        z_top=5.05,
        material=dark,
    )
    add_elliptical_wall(
        "Lower_Tier_LED_Ribbon",
        center_y=pitch_center_y,
        radius_x=44.1,
        radius_y=30.32,
        z_bottom=4.15,
        z_top=4.52,
        material=materials["blue_glow"],
    )
    add_elliptical_tier(
        "Camp_Nou_Middle_Tier",
        center_y=pitch_center_y,
        base_rx=45.0,
        base_ry=31.0,
        base_z=5.18,
        rows=10,
        row_depth=0.76,
        row_rise=0.31,
        materials=tier_materials,
        pattern_offset=2,
    )
    add_elliptical_wall(
        "Middle_Tier_Concourse",
        center_y=pitch_center_y,
        radius_x=52.8,
        radius_y=36.7,
        z_bottom=7.70,
        z_top=9.0,
        material=concrete,
    )
    add_elliptical_wall(
        "Middle_Tier_Dark_Band",
        center_y=pitch_center_y,
        radius_x=52.55,
        radius_y=36.52,
        z_bottom=7.96,
        z_top=8.58,
        material=dark,
    )
    add_elliptical_tier(
        "Camp_Nou_Upper_Tier",
        center_y=pitch_center_y,
        base_rx=53.25,
        base_ry=37.1,
        base_z=9.12,
        rows=16,
        row_depth=0.72,
        row_rise=0.36,
        materials=tier_materials,
        pattern_offset=4,
    )
    add_elliptical_wall(
        "Camp_Nou_Outer_Shell",
        center_y=pitch_center_y,
        radius_x=64.9,
        radius_y=45.65,
        z_bottom=9.0,
        z_top=14.6,
        material=concrete,
    )

    # The old Camp Nou's recognisable asymmetric covered grandstand.
    add_ramp(
        "Far_Grandstand_Canopy",
        width=83.0,
        y_start=68.2,
        y_end=78.0,
        z_start=15.65,
        z_end=17.55,
        thickness=0.34,
        material=metal,
    )
    add_box("Canopy_Gold_Edge", (0.0, 68.15, 15.67), (83.0, 0.18, 0.24), gold)
    for index, x in enumerate((-34.0, -22.5, -11.25, 0.0, 11.25, 22.5, 34.0), start=1):
        add_box(
            f"Canopy_Floodlight_{index:02d}",
            (x, 67.98, 15.44),
            (6.4, 0.12, 0.16),
            materials["light"],
        )
    for index, x in enumerate((-32.0, -21.5, -10.5, 0.0, 10.5, 21.5, 32.0), start=1):
        support = add_box(
            f"Canopy_Support_{index:02d}",
            (x, 75.0, 13.25),
            (0.18, 0.18, 7.2),
            metal,
        )
        support.rotation_euler[1] = math.radians(-8.0 if x < 0.0 else 8.0)

    add_box("Far_Stand_Wordmark_Back", (0.0, 67.20, 10.90), (28.0, 0.28, 2.65), dark, bevel=0.12)
    add_text(
        "Far_Stand_Wordmark",
        "FC BARCELONA",
        (0.0, 67.02, 10.88),
        gold,
        size=1.24,
        extrude=0.035,
        spacing=1.06,
    )


def build_scene() -> None:
    reset_scene()

    if not MURAL_PATH.exists():
        raise FileNotFoundError(f"Missing mural texture: {MURAL_PATH}")
    if not CREST_PATH.exists():
        raise FileNotFoundError(f"Missing crest texture: {CREST_PATH}")

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = END_FRAME
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["intro_version"] = "threshold-final-v3-procedural-camp-nou"
    scene["architecture_note"] = (
        "Original plausible interpretation for the dashboard; not a factual reconstruction."
    )

    world = bpy.data.worlds.new("Threshold_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.004,
        0.009,
        0.018,
        1.0,
    )
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18
    scene.world = world

    materials = {
        "dark": make_material("MAT_Navy_Black", (0.006, 0.014, 0.032, 1.0), roughness=0.55),
        "shell": make_material("MAT_Deep_Navy", (0.012, 0.035, 0.088, 1.0), roughness=0.48, coat=0.18),
        "blue": make_material("MAT_Blaugrana_Blue", (0.0, 0.075, 0.30, 1.0), roughness=0.4, coat=0.22),
        "claret": make_material("MAT_Blaugrana_Claret", (0.39, 0.0, 0.10, 1.0), roughness=0.44, coat=0.2),
        "gold": make_material("MAT_Catalan_Gold", (0.86, 0.50, 0.0, 1.0), metallic=0.30, roughness=0.38, coat=0.16),
        "concrete": make_material("MAT_Warm_Concrete", (0.19, 0.205, 0.22, 1.0), roughness=0.9),
        "metal": make_material("MAT_Brushed_Steel", (0.31, 0.34, 0.37, 1.0), metallic=0.9, roughness=0.28),
        "floor": make_material("MAT_Polished_Graphite", (0.035, 0.044, 0.052, 1.0), metallic=0.08, roughness=0.38, coat=0.22),
        "glass": make_material("MAT_Smoked_Glass", (0.025, 0.09, 0.13, 0.26), metallic=0.0, roughness=0.16),
        "turf": make_material("MAT_Pitch_Turf", (0.014, 0.19, 0.07, 1.0), roughness=0.9),
        "turf_light": make_material("MAT_Pitch_Turf_Light", (0.028, 0.27, 0.095, 1.0), roughness=0.88),
        "line": make_material("MAT_Pitch_White", (0.78, 0.82, 0.78, 1.0), roughness=0.6),
        "seat_blue": make_material(
            "MAT_Stadium_Seat_Blue",
            (0.008, 0.12, 0.44, 1.0),
            roughness=0.72,
            emission=(0.0, 0.025, 0.12),
            emission_strength=0.08,
        ),
        "seat_claret": make_material(
            "MAT_Stadium_Seat_Claret",
            (0.48, 0.008, 0.12, 1.0),
            roughness=0.74,
            emission=(0.16, 0.0, 0.025),
            emission_strength=0.07,
        ),
        "light": make_material(
            "MAT_Cove_Light",
            (0.46, 0.48, 0.46, 1.0),
            roughness=0.42,
            emission=(0.61, 0.64, 0.60),
            emission_strength=0.42,
        ),
        "blue_glow": make_material(
            "MAT_Blue_Glow",
            (0.0, 0.11, 0.40, 1.0),
            roughness=0.28,
            emission=(0.0, 0.06, 0.28),
            emission_strength=0.55,
        ),
        "claret_glow": make_material(
            "MAT_Claret_Glow",
            (0.45, 0.0, 0.11, 1.0),
            roughness=0.3,
            emission=(0.32, 0.0, 0.055),
            emission_strength=0.48,
        ),
    }
    mural = make_texture_material(
        "MAT_Original_Blaugrana_Mural",
        MURAL_PATH,
        roughness=0.58,
        emission_strength=0.16,
    )
    crest = make_texture_material(
        "MAT_FC_Barcelona_Crest",
        CREST_PATH,
        roughness=0.42,
        alpha=True,
        emission_strength=0.12,
    )
    # Main shell. The right wall opens into smoked glazing to keep the route spacious.
    add_box("Tunnel_Wall_Left", (-3.72, -0.6, 2.25), (0.28, 24.2, 4.5), materials["dark"])
    add_box("Tunnel_Wall_Right_Back", (5.35, -0.6, 2.25), (0.24, 24.2, 4.5), materials["dark"])
    add_box("Tunnel_Ceiling", (0.82, -0.6, 4.55), (9.2, 24.2, 0.24), materials["dark"])
    add_box("Tunnel_Floor_Main", (0.0, -3.55, -0.10), (7.2, 17.7, 0.22), materials["floor"])

    # Left wall: a quiet plinth, framed original mural, and dimensional seams.
    add_box("Left_Wall_Plinth", (-3.53, -1.4, 0.39), (0.12, 20.3, 0.78), materials["concrete"], bevel=0.025)
    add_box("Mural_Backplate", (-3.545, -3.05, 2.38), (0.09, 15.6, 3.05), materials["shell"], bevel=0.055)
    add_plane_yz(
        "Blaugrana_Mural",
        x=-3.485,
        y_start=-10.55,
        y_end=4.45,
        z_start=0.93,
        z_end=3.82,
        material=mural,
    )
    add_box("Mural_Gold_Top", (-3.45, -3.05, 3.87), (0.05, 15.3, 0.045), materials["gold"])
    add_box("Mural_Gold_Base", (-3.45, -3.05, 0.89), (0.05, 15.3, 0.045), materials["gold"])
    for index, y in enumerate((-10.55, -6.8, -3.05, 0.70, 4.45), start=1):
        add_box(
            f"Mural_Seam_{index:02d}",
            (-3.44, y, 2.38),
            (0.045, 0.035, 2.98),
            materials["metal"],
        )

    # Crest plaque announces the approach to the pitch without interfering with the mural.
    add_box("Crest_Plaque_Gold", (-3.50, 6.45, 2.35), (0.11, 2.45, 2.36), materials["gold"], bevel=0.11, bevel_segments=3)
    add_box("Crest_Plaque_Navy", (-3.43, 6.45, 2.35), (0.08, 2.25, 2.16), materials["dark"], bevel=0.09, bevel_segments=3)
    add_plane_yz(
        "FC_Barcelona_Crest",
        x=-3.38,
        y_start=5.60,
        y_end=7.30,
        z_start=1.50,
        z_end=3.20,
        material=crest,
    )

    # Right-hand glass bays with alternating club-colour light boxes behind them.
    add_box("Glass_Base_Wall", (3.61, -1.1, 0.38), (0.22, 19.0, 0.76), materials["concrete"], bevel=0.025)
    for index, y in enumerate((-9.6, -6.55, -3.5, -0.45, 2.6, 5.65), start=1):
        add_box(
            f"GlassBay_{index:02d}",
            (3.58, y, 2.30),
            (0.07, 2.82, 2.94),
            materials["glass"],
        )
        add_box(
            f"GlassGlow_{index:02d}",
            (4.88, y, 2.10),
            (0.035, 2.72, 2.52),
            materials["blue_glow"] if index % 2 else materials["claret_glow"],
        )
        add_box(
            f"GlassMullion_{index:02d}",
            (3.54, y - 1.48, 2.31),
            (0.15, 0.12, 3.18),
            materials["metal"],
            bevel=0.018,
        )
    add_box("GlassMullion_End", (3.54, 7.13, 2.31), (0.15, 0.12, 3.18), materials["metal"], bevel=0.018)
    add_box("Glass_Head", (3.54, -1.20, 3.84), (0.18, 19.7, 0.18), materials["metal"], bevel=0.02)

    # Rails and posts follow the slight ramp toward the exit.
    add_rail("Rail_Left", x=-2.96, y_start=-10.4, y_end=10.2, z_start=1.05, z_end=1.46, material=materials["metal"])
    add_rail("Rail_Right", x=2.96, y_start=-10.4, y_end=10.2, z_start=1.05, z_end=1.46, material=materials["metal"])
    for side_name, x in (("Left", -2.96), ("Right", 2.96)):
        for index, y in enumerate((-10.1, -6.7, -3.3, 0.1, 3.5, 6.9, 9.9), start=1):
            floor_z = 0.0 if y <= 4.8 else (y - 4.8) / 6.4 * 0.44
            add_box(
                f"RailPost_{side_name}_{index:02d}",
                (x, y, floor_z + 0.55),
                (0.065, 0.065, 1.10),
                materials["metal"],
                bevel=0.018,
            )

    # Continuous coves create stable forward motion without flashing cross-bars.
    add_box("Ceiling_Spine", (0.0, -0.5, 4.35), (2.18, 22.6, 0.16), materials["shell"], bevel=0.06)
    add_box("Ceiling_Cove_Left", (-0.78, -0.55, 4.245), (0.18, 22.1, 0.045), materials["light"], bevel=0.02)
    add_box("Ceiling_Cove_Right", (0.78, -0.55, 4.245), (0.18, 22.1, 0.045), materials["light"], bevel=0.02)
    add_box("Ceiling_Blue_Edge", (-3.24, -0.55, 4.15), (0.08, 22.0, 0.08), materials["blue_glow"])
    add_box("Ceiling_Claret_Edge", (3.24, -0.55, 4.15), (0.08, 22.0, 0.08), materials["claret_glow"])
    for index, y in enumerate((-9.4, -5.0, -0.6, 3.8, 8.2), start=1):
        add_box(
            f"Ceiling_Rib_{index:02d}",
            (0.0, y, 4.37),
            (6.5, 0.10, 0.13),
            materials["metal"],
            bevel=0.02,
        )

    # Exit ramp and a layered club-colour portal.
    add_ramp(
        "Tunnel_Exit_Ramp",
        width=7.2,
        y_start=4.8,
        y_end=11.25,
        z_start=0.0,
        z_end=0.44,
        thickness=0.22,
        material=materials["floor"],
    )
    add_box("Floor_Gold_Guide", (0.0, 1.20, 0.016), (0.055, 20.7, 0.024), materials["gold"])
    add_box("ExitPortal_Left_Outer", (-3.58, 11.35, 2.34), (0.46, 0.72, 4.68), materials["blue"], bevel=0.06)
    add_box("ExitPortal_Right_Outer", (3.58, 11.35, 2.34), (0.46, 0.72, 4.68), materials["claret"], bevel=0.06)
    add_box("ExitPortal_Left_Gold", (-3.32, 11.31, 2.34), (0.08, 0.78, 4.48), materials["gold"])
    add_box("ExitPortal_Right_Gold", (3.32, 11.31, 2.34), (0.08, 0.78, 4.48), materials["gold"])
    add_box("ExitPortal_Header", (0.0, 11.35, 4.28), (7.62, 0.72, 0.72), materials["dark"], bevel=0.07)
    add_box("ExitPortal_Header_Blue", (-1.82, 10.96, 4.35), (3.55, 0.035, 0.12), materials["blue"])
    add_box("ExitPortal_Header_Claret", (1.82, 10.96, 4.35), (3.55, 0.035, 0.12), materials["claret"])
    add_text(
        "ExitPortal_Motto",
        "MÉS QUE UN CLUB",
        (0.0, 10.965, 4.10),
        materials["gold"],
        size=0.34,
        extrude=0.018,
        spacing=1.08,
    )
    add_box("Exit_Threshold_Gold", (0.0, 11.35, 0.49), (7.20, 0.72, 0.075), materials["gold"], bevel=0.015)

    add_stadium_reveal(materials)

    # Inspection lights are intentionally modest. Runtime lighting is authored in React.
    exit_light_data = bpy.data.lights.new(name="Exit_Daylight_Data", type="AREA")
    exit_light_data.energy = 900.0
    exit_light_data.shape = "RECTANGLE"
    exit_light_data.size = 8.0
    exit_light_data.size_y = 4.0
    exit_light = bpy.data.objects.new("Exit_Daylight", exit_light_data)
    exit_light.location = (0.0, 14.4, 5.2)
    exit_light.rotation_euler = (math.radians(65.0), 0.0, math.radians(180.0))
    bpy.context.collection.objects.link(exit_light)

    path_points = [
        (0.0, -10.8, 1.68),
        (0.0, -8.2, 1.68),
        (-0.06, -2.8, 1.70),
        (0.03, 4.3, 1.78),
        (0.0, 9.2, 2.00),
        (0.0, 11.05, 2.08),
    ]
    add_camera_path(path_points)
    add_camera_animation()


def save_and_export() -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_cameras=True,
        export_lights=True,
        export_yup=True,
        export_apply=True,
    )

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangle_count = sum(len(obj.data.loop_triangles) for obj in mesh_objects)
    print(f"FINAL_BLEND={BLEND_PATH}")
    print(f"FINAL_GLB={GLB_PATH}")
    print(f"FINAL_GLB_BYTES={GLB_PATH.stat().st_size}")
    print(f"FINAL_MESH_OBJECTS={len(mesh_objects)}")
    print(f"FINAL_TRIANGLES={triangle_count}")


if __name__ == "__main__":
    build_scene()
    save_and_export()
