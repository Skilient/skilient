"""
Skilient marketing objects: warm clay + foil, rendered headless in Blender (Cycles, CPU).

  blender -b -P scripts/renders/objects.py -- --out /tmp/renders [--only seal,flare] [--samples 128] [--size 1024] [--preview]

Every object is built from code here, so a render can be repeated exactly. Light comes from the
top left like the UI (app/(marketing)/CLAUDE.md); floating objects render without a floor (the
page adds the drop shadow), grounded ones (tray, terraces) sit on a shadow catcher. Objects whose
body is clay render twice, `-light` and `-dark`, in the page's surface colour for each theme.
"""

import math
import sys
import argparse

import bmesh
import bpy
from mathutils import Vector

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="/tmp/renders")
ap.add_argument("--only", default="")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--preview", action="store_true")
ap.add_argument("--project", action="store_true", help="terraces only: write where each step's top lands in the image, no render")
args = ap.parse_args(argv)


def srgb(hex_colour, alpha=1.0):
    """'#E6E1D8' -> linear RGBA for Blender."""
    h = hex_colour.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, alpha)


CLAY = {"light": "#E6E1D8", "dark": "#3A3530"}
PAPER = "#F1EEE8"
INK = "#1B1B19"
SIGNAL = "#E1592B"
SIGNAL_TINT = "#EAAB93"
JUTE = "#C6A16A"


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------
def reset_scene(width, height):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24 if args.preview else args.samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 8
    scene.cycles.glossy_bounces = 4
    scene.cycles.transparent_max_bounces = 4
    scene.render.film_transparent = True
    scene.cycles.film_transparent_glass = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 25 if args.preview else 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    return scene


def world():
    """A warm gradient world: light above, deeper below, so metal and foil have something to reflect."""
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = srgb("#8A7D6C")
    ramp.color_ramp.elements[1].position = 0.45
    ramp.color_ramp.elements[1].color = srgb("#FFF8EE")
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.55
    nt.links.new(bg.outputs[0], out.inputs[0])


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def area_light(name, location, target, power, size, colour="#FFF4E6"):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.size = size
    data.color = srgb(colour)[:3]
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)
    return obj


def studio(target=(0, 0, 0), scale=1.0):
    """Key top-left (the UI's light), soft fill right, a rim from behind."""
    t = Vector(target)
    area_light("Key", t + Vector((-4.5, -4.0, 6.0)) * scale, t, 900 * scale * scale, 5 * scale)
    area_light("Fill", t + Vector((5.5, -3.5, 1.5)) * scale, t, 160 * scale * scale, 6 * scale, "#FFE9D6")
    area_light("Rim", t + Vector((1.5, 6.0, 4.0)) * scale, t, 420 * scale * scale, 3 * scale)


def camera(location, target, lens=85):
    data = bpy.data.cameras.new("Camera")
    data.lens = lens
    cam = bpy.data.objects.new("Camera", data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    look_at(cam, target)
    bpy.context.scene.camera = cam
    return cam


def shadow_floor(z=0.0, size=40):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    floor = bpy.context.active_object
    floor.is_shadow_catcher = True
    floor.name = "Floor"
    return floor


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def principled(name, colour, roughness=0.55, metallic=0.0, coat=0.0, sheen=0.0, subsurface=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(colour)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.25
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Subsurface Weight"].default_value = subsurface
    b.inputs["Subsurface Radius"].default_value = (0.4, 0.25, 0.15)
    b.inputs["Subsurface Scale"].default_value = 0.05
    return m


def add_noise_bump(m, scale=18.0, strength=0.06, distance=0.02):
    """Fine clay grain."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 6
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def add_weave_bump(m, scale=7.0, strength=0.35, distance=0.03):
    """The charpai weave: two sets of strands, a checker deciding which one is on top."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    wave_x = nt.nodes.new("ShaderNodeTexWave")
    wave_x.bands_direction = "X"
    wave_x.wave_profile = "SIN"
    wave_y = nt.nodes.new("ShaderNodeTexWave")
    wave_y.bands_direction = "Y"
    wave_y.wave_profile = "SIN"
    for w in (wave_x, wave_y):
        w.inputs["Scale"].default_value = 1.0
        w.inputs["Distortion"].default_value = 0.0
        nt.links.new(mapping.outputs["Vector"], w.inputs["Vector"])
    checker = nt.nodes.new("ShaderNodeTexChecker")
    checker.inputs["Scale"].default_value = 1.0
    nt.links.new(mapping.outputs["Vector"], checker.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    nt.links.new(checker.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(wave_x.outputs["Fac"], mix.inputs["A"])
    nt.links.new(wave_y.outputs["Fac"], mix.inputs["B"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(mix.outputs["Result"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def clay(name, colour, roughness=0.62):
    return add_noise_bump(principled(name, colour, roughness=roughness, coat=0.08, subsurface=0.04))


def foil(name):
    """Radiant: warm foil, rose gold sweeping to champagne, brushed (anisotropic)."""
    m = principled(name, "#F2CFA6", roughness=0.16, metallic=1.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Anisotropic"].default_value = 0.75
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, 0, math.radians(35))
    mapping.inputs["Scale"].default_value = (0.5, 0.5, 0.5)
    mapping.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    grad = nt.nodes.new("ShaderNodeTexGradient")
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position = 0.15
    els[0].color = srgb("#E7A27A")
    els[1].position = 0.9
    els[1].color = srgb("#FFEBCB")
    mid = els.new(0.5)
    mid.color = srgb("#F6CB95")
    nt.links.new(grad.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def iridescent(name):
    """Luminary: pastel rainbow foil. The hue runs with the viewing angle and across the face,
    so the colour shifts the way an iridescent film does."""
    m = principled(name, "#E6E4EE", roughness=0.14, metallic=1.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.3
    noise.inputs["Detail"].default_value = 2
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    facing = nt.nodes.new("ShaderNodeLayerWeight")
    facing.inputs["Blend"].default_value = 0.5
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs[0])
    hue = nt.nodes.new("ShaderNodeMath")
    hue.operation = "MULTIPLY_ADD"
    nt.links.new(noise.outputs["Fac"], hue.inputs[0])
    hue.inputs[1].default_value = 0.9
    nt.links.new(facing.outputs["Facing"], hue.inputs[2])
    plus_x = nt.nodes.new("ShaderNodeMath")
    plus_x.operation = "MULTIPLY_ADD"
    nt.links.new(sep.outputs["X"], plus_x.inputs[0])
    plus_x.inputs[1].default_value = 0.35
    nt.links.new(hue.outputs[0], plus_x.inputs[2])
    wrap = nt.nodes.new("ShaderNodeMath")
    wrap.operation = "FRACT"
    nt.links.new(plus_x.outputs[0], wrap.inputs[0])
    hsv = nt.nodes.new("ShaderNodeCombineColor")
    hsv.mode = "HSV"
    nt.links.new(wrap.outputs[0], hsv.inputs[0])
    hsv.inputs[1].default_value = 0.42
    hsv.inputs[2].default_value = 0.97
    nt.links.new(hsv.outputs[0], b.inputs["Base Color"])
    return m


def glass(name, tint="#EEF3F2"):
    """Clear glass (the loupe's lens, the bulb): it refracts what is behind it, the page shows through."""
    m = principled(name, tint, roughness=0.02)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.45
    return m


def glow(name, colour, strength=8.0):
    m = principled(name, colour, roughness=0.4)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = srgb(colour)
    b.inputs["Emission Strength"].default_value = strength
    return m


def gold(name):
    return principled(name, "#E3B13A", roughness=0.24, metallic=1.0)


def tier_material(tier, theme="light"):
    if tier == "raw":
        return add_weave_bump(principled("raw", JUTE, roughness=0.85), scale=9.0, strength=0.25)
    if tier == "spark":
        return clay("spark", SIGNAL_TINT, roughness=0.5)
    if tier == "flare":
        m = clay("flare", SIGNAL, roughness=0.42)
        m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.35
        return m
    if tier == "shine":
        return gold("shine")
    if tier == "radiant":
        return foil("radiant")
    return iridescent("luminary")


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def prism(name, points, depth, materials, side_material=None, inset=None, parent=None):
    """A flat 2D outline extruded upward by `depth`. Top/bottom take material 0, sides material 1.
    `inset=(thickness, depth)` sinks a field into the top face, leaving a raised rim."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0.0)) for x, y in points]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    if face.normal.z > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face], use_keep_orig=True)
    top_verts = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top_verts, vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if inset:
        top = max(bm.faces, key=lambda f: f.calc_center_median().z * (1 if f.normal.z > 0.9 else -9))
        bmesh.ops.inset_individual(bm, faces=[top], thickness=inset[0], depth=-inset[1])
    for f in bm.faces:
        f.material_index = 0 if abs(f.normal.z) > 0.5 else 1
        f.smooth = True
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    for m in materials:
        mesh.materials.append(m)
    if len(materials) == 1:
        mesh.materials.append(side_material or materials[0])
    link(obj, parent)
    return obj


def bevel(obj, width=0.04, segments=5, angle=40):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = True
    mod.miter_outer = "MITER_ARC"
    return mod


def rounded_box(name, size, radius, material, location=(0, 0, 0), parent=None, segments=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, width=radius, segments=segments, angle=30)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(material)
    if parent is not None:
        obj.parent = parent
    return obj


def cylinder(name, radius, depth, material, location=(0, 0, 0), parent=None, verts=96, bevel_width=0.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if bevel_width:
        bevel(obj, width=bevel_width, segments=4, angle=30)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(material)
    if parent is not None:
        obj.parent = parent
    return obj


def tube(name, points, radius, material, parent=None):
    """A round tube through 3D points (the check mark, glyph strokes)."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, curve)
    curve.materials.append(material)
    return link(obj, parent)


def root(name, rotation_deg=(0, 0, 0), location=(0, 0, 0)):
    empty = bpy.data.objects.new(name, None)
    link(empty)
    empty.location = location
    empty.rotation_euler = [math.radians(a) for a in rotation_deg]
    return empty


def star_points(n_points, r_outer, r_inner):
    pts = []
    for i in range(n_points * 2):
        r = r_outer if i % 2 == 0 else r_inner
        a = math.pi * i / n_points + math.pi / 2
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def circle_points(n, r, wobble=0.0, lobes=0):
    return [
        (
            r * (1 + wobble * math.cos(lobes * 2 * math.pi * i / n)) * math.cos(2 * math.pi * i / n),
            r * (1 + wobble * math.cos(lobes * 2 * math.pi * i / n)) * math.sin(2 * math.pi * i / n),
        )
        for i in range(n)
    ]


def pawn(name, material, location, parent=None, scale=1.0):
    """A teammate: a rounded body and a head, like a game piece without the game."""
    group = root(name, location=location)
    if parent is not None:
        group.parent = parent
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.27 * scale, radius2=0.13 * scale, depth=0.46 * scale, location=(0, 0, 0.23 * scale))
    body = bpy.context.active_object
    bevel(body, width=0.06 * scale, segments=6, angle=20)
    body.data.materials.append(material)
    body.parent = group
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.17 * scale, location=(0, 0, 0.6 * scale))
    head = bpy.context.active_object
    head.data.materials.append(material)
    head.parent = group
    for o in (body, head):
        for p in o.data.polygons:
            p.use_smooth = True
    return group


# ---------------------------------------------------------------------------
# Objects
# ---------------------------------------------------------------------------
def build_seal():
    """The verified seal: 18 notched points in ink clay, a foil edge, a raised white check."""
    r = root("seal", (52, 0, 16))
    ink = principled("ink", INK, roughness=0.42, coat=0.25)
    edge = foil("edge")
    body = prism("seal-body", star_points(18, 1.0, 0.9), 0.24, [ink], side_material=edge, inset=(0.12, 0.035), parent=r)
    bevel(body, width=0.035, segments=5, angle=35)
    white = clay("check", PAPER, roughness=0.5)
    z = 0.24 - 0.035 + 0.055
    tube("seal-check", [(-0.36, 0.02, z), (-0.1, -0.26, z), (0.4, 0.3, z)], 0.075, white, parent=r)
    return r, 1.15


def build_medallion(tier):
    """One shape for all six tiers; only the finish changes. A staircase rises across a sunk face."""
    r = root(f"medallion-{tier}", (50, 0, 16))
    m = tier_material(tier)
    coin = prism("coin", circle_points(128, 1.0), 0.28, [m], inset=(0.13, 0.08), parent=r)
    bevel(coin, width=0.05, segments=6, angle=30)
    stairs = [(-0.5, -0.38), (0.5, -0.38), (0.5, 0.42), (0.17, 0.42), (0.17, 0.15), (-0.17, 0.15), (-0.17, -0.12), (-0.5, -0.12)]
    s = prism("stairs", stairs, 0.12, [m], parent=r)
    bevel(s, width=0.03, segments=4, angle=35)
    s.location.z = 0.28 - 0.08
    return r, None


def build_commit():
    """A paper keycap with the commit glyph in ink: a ring on a line."""
    r = root("commit", (48, 0, -22))
    paper = clay("paper", PAPER, roughness=0.55)
    ink = principled("ink", INK, roughness=0.4, coat=0.2)
    rounded_box("cap", (1.6, 1.6, 0.56), 0.24, paper, location=(0, 0, 0.28), parent=r, segments=8)
    z = 0.56 + 0.05
    bpy.ops.mesh.primitive_torus_add(major_radius=0.27, minor_radius=0.075, major_segments=96, minor_segments=24, location=(0, 0, z))
    ring = bpy.context.active_object
    ring.data.materials.append(ink)
    ring.parent = r
    for p in ring.data.polygons:
        p.use_smooth = True
    tube("bar-l", [(-0.62, 0, z), (-0.34, 0, z)], 0.075, ink, parent=r)
    tube("bar-r", [(0.34, 0, z), (0.62, 0, z)], 0.075, ink, parent=r)
    return r, 1.25


def build_rosette():
    """An endorsement: a ruffled orange rosette with a paper centre and two tails."""
    r = root("rosette", (54, 0, 10))
    orange = clay("signal", SIGNAL, roughness=0.45)
    tint = clay("tint", SIGNAL_TINT, roughness=0.5)
    paper = clay("paper", PAPER, roughness=0.55)
    ink = principled("ink", INK, roughness=0.4)
    disc = prism("ruffle", circle_points(240, 0.9, wobble=0.07, lobes=20), 0.16, [orange], parent=r)
    bevel(disc, width=0.035, segments=4, angle=35)
    disc.location.z = 0.12
    centre = cylinder("centre", 0.55, 0.12, paper, location=(0, 0, 0.34), parent=r, bevel_width=0.035)
    z = 0.34 + 0.06 + 0.04
    tube("tick", [(-0.22, 0.0, z), (-0.05, -0.17, z), (0.25, 0.18, z)], 0.055, ink, parent=r)
    tail = [(-0.19, 0), (0.19, 0), (0.19, -1.05), (0.0, -0.86), (-0.19, -1.05)]
    for side in (-1, 1):
        t = prism(f"tail{side}", tail, 0.05, [tint], parent=r)
        bevel(t, width=0.015, segments=3, angle=35)
        t.location = (0.18 * side, -0.35, 0.02)
        t.rotation_euler = (0, 0, math.radians(16 * side))
    return r, 1.35


def build_envelope():
    """Day one: a paper envelope sealed in orange, an @ pressed into the seal."""
    r = root("envelope", (50, 0, -14))
    paper = add_noise_bump(principled("paper", PAPER, roughness=0.72), scale=40, strength=0.04)
    flap = add_noise_bump(principled("flap", "#E9E2D5", roughness=0.75), scale=40, strength=0.04)
    orange = clay("seal", SIGNAL, roughness=0.42)
    deep = principled("seal-deep", "#B5431C", roughness=0.5)
    rounded_box("body", (1.95, 1.3, 0.14), 0.05, paper, location=(0, 0, 0.07), parent=r, segments=5)
    f = prism("flap", [(-0.96, 0.64), (0.96, 0.64), (0.0, -0.08)], 0.025, [flap], parent=r)
    bevel(f, width=0.012, segments=3, angle=35)
    f.location.z = 0.14
    wax = prism("wax", circle_points(160, 0.24, wobble=0.06, lobes=9), 0.08, [orange], parent=r)
    bevel(wax, width=0.03, segments=5, angle=35)
    wax.location = (0, -0.06, 0.16)
    text = bpy.data.curves.new("at", "FONT")
    text.body = "@"
    text.size = 0.28
    text.extrude = 0.012
    text.bevel_depth = 0.006
    text.align_x = "CENTER"
    text.align_y = "CENTER"
    t = bpy.data.objects.new("at", text)
    text.materials.append(deep)
    link(t, r)
    t.location = (0, -0.06, 0.16 + 0.08 + 0.004)
    return r, 1.3


def build_tray(theme):
    """The team: a woven tray with six sockets, three of them filled."""
    r = root("tray", (0, 0, 14))
    body = add_weave_bump(principled("clay", CLAY[theme], roughness=0.72, coat=0.04), scale=4.0, strength=0.45, distance=0.04)
    frame = add_noise_bump(principled("frame", JUTE, roughness=0.6, coat=0.15), scale=30, strength=0.05)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15))
    tray = bpy.context.active_object
    tray.name = "tray"
    tray.scale = (3.3, 2.2, 0.3)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    sockets = [(-1.05, 0.5), (0, 0.5), (1.05, 0.5), (-1.05, -0.5), (0, -0.5), (1.05, -0.5)]
    cutters = []
    for x, y in sockets:
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.33, depth=0.4, location=(x, y, 0.3))
        cutters.append(bpy.context.active_object)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = tray
    tray.select_set(True)
    for c in cutters:
        mod = tray.modifiers.new(f"cut-{c.name}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = c
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in cutters:
        bpy.data.objects.remove(c, do_unlink=True)
    # Sockets first, then the bevel, so the socket rims round too.
    bevel(tray, width=0.1, segments=6, angle=30)
    for poly in tray.data.polygons:
        poly.use_smooth = True
    tray.data.materials.append(body)
    tray.parent = r
    for name, size, loc in [
        ("frame-n", (3.42, 0.18, 0.12), (0, 1.06, 0.34)),
        ("frame-s", (3.42, 0.18, 0.12), (0, -1.06, 0.34)),
        ("frame-e", (0.18, 2.3, 0.12), (1.62, 0, 0.34)),
        ("frame-w", (0.18, 2.3, 0.12), (-1.62, 0, 0.34)),
    ]:
        rounded_box(name, size, 0.05, frame, location=loc, parent=r, segments=4)
    people = [("ayesha", SIGNAL), ("bilal", SIGNAL_TINT), ("sara", JUTE)]
    for (name, colour), (x, y) in zip(people, [sockets[0], sockets[1], sockets[3]]):
        pawn(name, clay(name, colour, roughness=0.45), (x, y, 0.14), parent=r, scale=1.05)
    shadow_floor(0.0)
    return r, 2.1


def build_terraces(theme):
    """The climb: six steps rising left to right, each topped with its tier finish; a marker on Flare."""
    r = root("terraces")
    body = clay("clay", CLAY[theme], roughness=0.68)
    tiers = ["raw", "spark", "flare", "shine", "radiant", "luminary"]
    for i, tier in enumerate(tiers):
        h = 0.6 + i * 0.7
        x = i * 2.4
        rounded_box(f"step-{tier}", (2.15, 2.2, h), 0.08, body, location=(x, 0, h / 2), parent=r, segments=5)
        rounded_box(f"inlay-{tier}", (1.8, 1.85, 0.07), 0.03, tier_material(tier), location=(x, 0, h + 0.025), parent=r, segments=4)
        if tier == "flare":
            pawn("marker", clay("marker", SIGNAL, roughness=0.42), (x, -0.1, h + 0.06), parent=r, scale=1.45)
    shadow_floor(0.0, size=120)
    return r, None



# ---------------------------------------------------------------------------
# Organisation pages (decisions 2026-11-01)
# ---------------------------------------------------------------------------
GREY_INK = "#5C564D"
STONE = "#E2D7C3"
WOOD = "#8C6A43"


def strips(prefix, rows, material, z, parent, height=0.065, thickness=0.018):
    """Lines of text as raised strips: rows of (x_left, y, length)."""
    for i, (x, y, length) in enumerate(rows):
        rounded_box(f"{prefix}{i}", (length, height, thickness), height / 2.2, material, location=(x + length / 2, y, z + thickness / 2), parent=parent, segments=3)


def build_loupe():
    """Recruiters: a loupe over a record card. The lens refracts the lines and the orange tick under it."""
    r = root("loupe", (50, 0, -16))
    paper = add_noise_bump(principled("paper", PAPER, roughness=0.7), scale=40, strength=0.03)
    lines = principled("lines", GREY_INK, roughness=0.6)
    orange = clay("signal", SIGNAL, roughness=0.42)
    ink = principled("ink", INK, roughness=0.38, coat=0.3)
    jute = add_noise_bump(principled("handle", JUTE, roughness=0.55, coat=0.2), scale=30, strength=0.04)
    rounded_box("card", (1.55, 1.95, 0.07), 0.07, paper, location=(0, 0, 0.035), parent=r, segments=5)
    strips("line", [(-0.6, 0.62, 1.1), (-0.6, 0.42, 0.75), (-0.6, 0.1, 0.95), (-0.6, -0.1, 0.62), (-0.6, -0.42, 0.85)], lines, 0.07, r)
    z = 0.07 + 0.04
    tube("tick", [(0.12, -0.12, z), (0.24, -0.25, z), (0.5, 0.06, z)], 0.04, orange, parent=r)
    lens_c = (0.3, -0.12, 0.62)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.56, minor_radius=0.075, major_segments=128, minor_segments=24, location=lens_c)
    ring = bpy.context.active_object
    ring.data.materials.append(ink)
    ring.parent = r
    cylinder("lens", 0.53, 0.06, glass("lens"), location=lens_c, parent=r, bevel_width=0.025)
    for o in (ring,):
        for poly in o.data.polygons:
            poly.use_smooth = True
    d = Vector((0.62, -0.62, 0.05)).normalized()
    start = Vector(lens_c) + d * 0.6
    tube("collar", [tuple(start), tuple(start + d * 0.16)], 0.1, ink, parent=r)
    tube("handle", [tuple(start + d * 0.16), tuple(start + d * 1.05)], 0.085, jute, parent=r)
    return r, None


def build_letter():
    """Recruiters: the company's letter, sealed in ink with a tick, an orange band across the top."""
    r = root("letter", (50, 0, 12))
    paper = add_noise_bump(principled("paper", PAPER, roughness=0.72), scale=40, strength=0.035)
    lines = principled("lines", GREY_INK, roughness=0.6)
    tint = clay("band", SIGNAL_TINT, roughness=0.5)
    ink = principled("ink", INK, roughness=0.4, coat=0.25)
    white = clay("tick", PAPER, roughness=0.5)
    rounded_box("sheet", (1.45, 1.95, 0.04), 0.035, paper, location=(0, 0, 0.02), parent=r, segments=4)
    rounded_box("band", (1.2, 0.14, 0.015), 0.05, tint, location=(0, 0.75, 0.0475), parent=r, segments=3)
    strips("line", [(-0.6, 0.45, 1.05), (-0.6, 0.27, 0.9), (-0.6, 0.09, 1.0), (-0.6, -0.09, 0.7), (-0.6, -0.36, 0.55)], lines, 0.04, r)
    wax = prism("wax", circle_points(160, 0.25, wobble=0.06, lobes=9), 0.08, [ink], parent=r)
    bevel(wax, width=0.03, segments=5, angle=35)
    wax.location = (0.38, -0.62, 0.04)
    z = 0.04 + 0.08 + 0.03
    tube("seal-tick", [(0.27, -0.62, z), (0.34, -0.69, z), (0.5, -0.52, z)], 0.032, white, parent=r)
    return r, None


def build_campus():
    """Universities: a clay campus, columns on stepped stone, an orange pennant on the roof."""
    r = root("campus", (14, 0, 24))
    stone = add_noise_bump(principled("stone", STONE, roughness=0.65), scale=24, strength=0.04)
    paper = principled("wall", PAPER, roughness=0.7)
    ink = principled("ink", INK, roughness=0.5)
    orange = clay("signal", SIGNAL, roughness=0.42)
    for i, (w, d) in enumerate([(2.7, 1.7), (2.5, 1.55), (2.3, 1.4)]):
        rounded_box(f"step{i}", (w, d, 0.13), 0.04, stone, location=(0, 0, 0.065 + i * 0.13), parent=r, segments=3)
    base = 0.39
    rounded_box("wall", (2.0, 0.22, 1.0), 0.03, paper, location=(0, 0.35, base + 0.5), parent=r, segments=3)
    rounded_box("door", (0.34, 0.06, 0.56), 0.03, ink, location=(0, 0.22, base + 0.28), parent=r, segments=3)
    for i in range(6):
        x = -0.85 + i * 0.34
        cylinder(f"col{i}", 0.085, 1.0, stone, location=(x, -0.45, base + 0.5), parent=r, verts=48, bevel_width=0.015)
    rounded_box("architrave", (2.35, 1.3, 0.15), 0.03, stone, location=(0, -0.02, base + 1.075), parent=r, segments=3)
    ped = prism("pediment", [(-1.17, 0), (1.17, 0), (0, 0.46)], 1.25, [stone], parent=r)
    bevel(ped, width=0.02, segments=3, angle=35)
    ped.rotation_euler = (math.radians(90), 0, 0)
    ped.location = (0, 0.6, base + 1.15)
    tube("pole", [(0.0, 0.0, base + 1.55), (0.0, 0.0, base + 2.25)], 0.02, ink, parent=r)
    flag = prism("flag", [(0, 0), (0.5, -0.12), (0, -0.26)], 0.03, [orange], parent=r)
    flag.rotation_euler = (math.radians(90), 0, 0)
    flag.location = (0.0, 0.015, base + 2.25)
    shadow_floor(0.0)
    return r, None


def build_booth():
    """Universities: a job-fair booth with a striped awning, and two students in the queue."""
    r = root("booth", (10, 0, -26))
    jute = add_noise_bump(principled("floor", JUTE, roughness=0.7), scale=20, strength=0.05)
    paper = principled("paper", PAPER, roughness=0.65)
    stone = principled("board", STONE, roughness=0.65)
    ink = principled("ink", INK, roughness=0.45, coat=0.2)
    orange = clay("signal", SIGNAL, roughness=0.42)
    rounded_box("floor", (2.5, 2.9, 0.08), 0.04, jute, location=(0, -0.55, 0.04), parent=r, segments=3)
    rounded_box("counter", (2.0, 0.62, 0.78), 0.05, paper, location=(0, -0.3, 0.47), parent=r, segments=4)
    rounded_box("band", (2.02, 0.03, 0.15), 0.01, orange, location=(0, -0.62, 0.7), parent=r, segments=2)
    rounded_box("board", (2.2, 0.12, 1.75), 0.04, stone, location=(0, 0.62, 0.955), parent=r, segments=3)
    rounded_box("screen", (1.05, 0.03, 0.62), 0.03, ink, location=(0, 0.55, 1.22), parent=r, segments=3)
    for i, h in enumerate((0.18, 0.3, 0.42)):
        rounded_box(f"bar{i}", (0.14, 0.02, h), 0.01, orange, location=(-0.22 + i * 0.22, 0.525, 0.98 + h / 2), parent=r, segments=2)
    for i in range(6):
        slat = rounded_box(f"slat{i}", (0.37, 0.75, 0.05), 0.02, orange if i % 2 == 0 else paper, location=(-0.925 + i * 0.37, 0.25, 1.86), parent=r, segments=2)
        slat.rotation_euler = (math.radians(-16), 0, 0)
    rounded_box("sign", (1.0, 0.08, 0.26), 0.04, ink, location=(0, 0.62, 2.0), parent=r, segments=3)
    cylinder("sign-dot", 0.06, 0.02, orange, location=(-0.36, 0.575, 2.0), parent=r, verts=48, bevel_width=0.0).rotation_euler = (math.radians(90), 0, 0)
    pawn("first", clay("first", SIGNAL, roughness=0.42), (-0.25, -1.05, 0.08), parent=r, scale=1.0)
    pawn("second", clay("second", SIGNAL_TINT, roughness=0.5), (0.2, -1.55, 0.08), parent=r, scale=1.0)
    shadow_floor(0.0)
    return r, None


def build_ticket():
    """Universities: an event ticket with its stub, the perforation and a check-in code."""
    r = root("ticket", (50, 0, -16))
    paper = add_noise_bump(principled("paper", PAPER, roughness=0.68), scale=40, strength=0.03)
    orange = clay("signal", SIGNAL, roughness=0.45)
    ink = principled("ink", INK, roughness=0.5)
    lines = principled("lines", GREY_INK, roughness=0.6)
    pts = [(-1.0, -0.45), (0.35, -0.45)]
    pts += [(0.45 + 0.1 * math.cos(t), -0.45 + 0.1 * math.sin(t)) for t in [math.pi - k * math.pi / 12 for k in range(1, 12)]]
    pts += [(0.55, -0.45), (1.0, -0.45), (1.0, 0.45), (0.55, 0.45)]
    pts += [(0.45 + 0.1 * math.cos(t), 0.45 + 0.1 * math.sin(t)) for t in [-k * math.pi / 12 for k in range(1, 12)]]
    pts += [(0.35, 0.45), (-1.0, 0.45)]
    body = prism("ticket", pts, 0.05, [paper], parent=r)
    bevel(body, width=0.03, segments=4, angle=35)
    rounded_box("band", (0.2, 0.9, 0.012), 0.004, orange, location=(-0.89, 0, 0.056), parent=r, segments=2)
    for i in range(7):
        cylinder(f"perf{i}", 0.016, 0.012, lines, location=(0.45, -0.27 + i * 0.09, 0.056), parent=r, verts=24, bevel_width=0.0)
    strips("line", [(-0.62, 0.22, 0.85), (-0.62, 0.04, 0.6), (-0.62, -0.2, 0.7)], lines, 0.05, r)
    cells = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]
    for k, on in enumerate(cells):
        if on:
            cx = 0.63 + (k % 5) * 0.065
            cy = 0.13 - (k // 5) * 0.065
            rounded_box(f"qr{k}", (0.055, 0.055, 0.012), 0.008, ink, location=(cx, cy, 0.056), parent=r, segments=2)
    return r, None


def build_pen():
    """Faculty: a fountain pen in ink with a gold nib and clip, lying across the page."""
    r = root("pen", (28, -6, 30))
    ink = principled("ink", INK, roughness=0.28, coat=0.6)
    gold_m = gold("gold")
    def along_x(obj):
        obj.rotation_euler = (0, math.radians(90), 0)
        return obj
    along_x(cylinder("barrel", 0.13, 1.35, ink, location=(-0.05, 0, 0), parent=r, verts=64, bevel_width=0.03))
    along_x(cylinder("cap", 0.142, 0.78, ink, location=(0.95, 0, 0), parent=r, verts=64, bevel_width=0.05))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.142, location=(1.34, 0, 0))
    end = bpy.context.active_object
    end.data.materials.append(ink)
    end.parent = r
    bpy.ops.mesh.primitive_torus_add(major_radius=0.142, minor_radius=0.022, major_segments=64, minor_segments=16, location=(0.57, 0, 0), rotation=(0, math.radians(90), 0))
    band = bpy.context.active_object
    band.data.materials.append(gold_m)
    band.parent = r
    clip = rounded_box("clip", (0.62, 0.05, 0.04), 0.015, gold_m, location=(0.98, 0, 0.165), parent=r, segments=3)
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.12, radius2=0.075, depth=0.3, location=(-0.87, 0, 0), rotation=(0, math.radians(-90), 0))
    grip = bpy.context.active_object
    grip.data.materials.append(ink)
    grip.parent = r
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.075, radius2=0.004, depth=0.36, location=(-1.2, 0, 0), rotation=(0, math.radians(-90), 0))
    nib = bpy.context.active_object
    nib.scale = (1, 1, 0.45)
    nib.data.materials.append(gold_m)
    nib.parent = r
    for o in (end, band, grip, nib):
        for poly in o.data.polygons:
            poly.use_smooth = True
    return r, None


def build_bulb():
    """Faculty: a project idea, a glass bulb with a glowing orange filament on a clay base."""
    r = root("bulb", (8, 0, -12))
    glass_m = glass("glass", "#F4F6F3")
    metal = principled("metal", "#CFC7B8", roughness=0.3, metallic=1.0)
    ink = principled("ink", INK, roughness=0.5)
    filament = glow("filament", "#FF7A3C", strength=40.0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=0.62, location=(0, 0, 1.05))
    bulb = bpy.context.active_object
    bulb.scale = (1, 1, 1.06)
    bulb.data.materials.append(glass_m)
    bulb.parent = r
    bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=0.3, radius2=0.42, depth=0.42, location=(0, 0, 0.5))
    neck = bpy.context.active_object
    neck.data.materials.append(glass_m)
    neck.parent = r
    for o in (bulb, neck):
        for poly in o.data.polygons:
            poly.use_smooth = True
    for i in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.29, minor_radius=0.05, major_segments=64, minor_segments=16, location=(0, 0, 0.08 + i * 0.07))
        t = bpy.context.active_object
        t.data.materials.append(metal)
        t.parent = r
        for poly in t.data.polygons:
            poly.use_smooth = True
    cylinder("cap", 0.27, 0.3, metal, location=(0, 0, 0.17), parent=r, verts=64, bevel_width=0.02)
    cylinder("contact", 0.12, 0.08, ink, location=(0, 0, -0.01), parent=r, verts=48, bevel_width=0.02)
    tube("stem-l", [(-0.12, 0, 0.45), (-0.16, 0, 0.98)], 0.012, ink, parent=r)
    tube("stem-r", [(0.12, 0, 0.45), (0.16, 0, 0.98)], 0.012, ink, parent=r)
    zig = [(-0.16, 0, 0.98)] + [(-0.16 + k * 0.04, 0, 0.98 + (0.07 if k % 2 else 0.0)) for k in range(1, 8)] + [(0.16, 0, 0.98)]
    tube("filament", zig, 0.022, filament, parent=r)
    return r, None


def build_page():
    """Faculty: a page of code marked up in orange: ticks in the margin, one line circled."""
    r = root("page", (50, 0, 14))
    paper = add_noise_bump(principled("paper", PAPER, roughness=0.7), scale=40, strength=0.03)
    lines = principled("lines", GREY_INK, roughness=0.6)
    tint = clay("keyword", SIGNAL_TINT, roughness=0.55)
    orange = clay("signal", SIGNAL, roughness=0.42)
    rounded_box("sheet", (1.5, 2.0, 0.035), 0.03, paper, location=(0, 0, 0.0175), parent=r, segments=4)
    rows = [(0.0, 0.7), (0.12, 0.55), (0.12, 0.8), (0.24, 0.45), (0.24, 0.62), (0.12, 0.5), (0.0, 0.3), (0.12, 0.66), (0.0, 0.4)]
    for i, (indent, length) in enumerate(rows):
        y = 0.75 - i * 0.18
        x = -0.48 + indent
        kw = 0.16 if i % 3 == 0 else 0.0
        if kw:
            rounded_box(f"kw{i}", (kw, 0.06, 0.016), 0.025, tint, location=(x + kw / 2, y, 0.035 + 0.008), parent=r, segments=3)
        rounded_box(f"code{i}", (length, 0.06, 0.016), 0.025, lines, location=(x + kw + 0.03 + length / 2, y, 0.035 + 0.008), parent=r, segments=3)
    z = 0.035 + 0.035
    for y in (0.57, 0.03):
        tube(f"tick{y}", [(-0.66, y + 0.01, z), (-0.6, y - 0.05, z), (-0.5, y + 0.07, z)], 0.025, orange, parent=r)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.018, major_segments=96, minor_segments=12, location=(-0.05, -0.33, z))
    ring = bpy.context.active_object
    ring.scale = (1.35, 0.42, 1)
    ring.data.materials.append(orange)
    ring.parent = r
    return r, None


def build_chai():
    """About: two cups of chai on a woven charpai, the dhaba table where it started."""
    r = root("chai", (0, 0, 26))
    wood = add_noise_bump(principled("wood", WOOD, roughness=0.55, coat=0.15), scale=26, strength=0.05)
    weave = add_weave_bump(principled("weave", JUTE, roughness=0.8), scale=11.0, strength=0.5, distance=0.03)
    cup = principled("cup", PAPER, roughness=0.3, coat=0.4)
    band = clay("band", SIGNAL, roughness=0.4)
    tea = principled("tea", "#9A6638", roughness=0.15, coat=0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder(f"leg{sx}{sy}", 0.075, 0.62, wood, location=(sx * 0.92, sy * 0.56, 0.31), parent=r, verts=32, bevel_width=0.02)
    for name, size, loc in [
        ("rail-n", (2.04, 0.13, 0.13), (0, 0.56, 0.62)),
        ("rail-s", (2.04, 0.13, 0.13), (0, -0.56, 0.62)),
        ("rail-e", (0.13, 1.25, 0.13), (0.92, 0, 0.62)),
        ("rail-w", (0.13, 1.25, 0.13), (-0.92, 0, 0.62)),
    ]:
        rounded_box(name, size, 0.045, wood, location=loc, parent=r, segments=4)
    rounded_box("woven", (1.74, 0.99, 0.04), 0.015, weave, location=(0, 0, 0.635), parent=r, segments=2)
    top = 0.655
    for i, (x, y) in enumerate([(-0.36, 0.08), (0.32, -0.12)]):
        cylinder(f"saucer{i}", 0.27, 0.03, cup, location=(x, y, top + 0.015), parent=r, verts=96, bevel_width=0.012)
        bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=0.135, radius2=0.175, depth=0.27, location=(x, y, top + 0.03 + 0.135))
        body = bpy.context.active_object
        bevel(body, width=0.015, segments=4, angle=30)
        body.data.materials.append(cup)
        body.parent = r
        for poly in body.data.polygons:
            poly.use_smooth = True
        cylinder(f"tea{i}", 0.158, 0.012, tea, location=(x, y, top + 0.03 + 0.27 + 0.002), parent=r, verts=96, bevel_width=0.0)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.014, major_segments=96, minor_segments=12, location=(x, y, top + 0.03 + 0.2))
        ring = bpy.context.active_object
        ring.data.materials.append(band)
        ring.parent = r
        bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.02, major_segments=48, minor_segments=12, location=(x + 0.19, y, top + 0.03 + 0.14), rotation=(math.radians(90), 0, 0))
        handle = bpy.context.active_object
        handle.data.materials.append(cup)
        handle.parent = r
        for o in (ring, handle):
            for poly in o.data.polygons:
                poly.use_smooth = True
    shadow_floor(0.0)
    return r, None


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------
JOBS = {
    "seal": (build_seal, None),
    "medallion-raw": (lambda: build_medallion("raw"), None),
    "medallion-spark": (lambda: build_medallion("spark"), None),
    "medallion-flare": (lambda: build_medallion("flare"), None),
    "medallion-shine": (lambda: build_medallion("shine"), None),
    "medallion-radiant": (lambda: build_medallion("radiant"), None),
    "medallion-luminary": (lambda: build_medallion("luminary"), None),
    "commit": (build_commit, None),
    "rosette": (build_rosette, None),
    "envelope": (build_envelope, None),
    "tray-light": (lambda: build_tray("light"), None),
    "tray-dark": (lambda: build_tray("dark"), None),
    "loupe": (build_loupe, None),
    "letter": (build_letter, None),
    "campus": (build_campus, None),
    "booth": (build_booth, None),
    "ticket": (build_ticket, None),
    "pen": (build_pen, None),
    "bulb": (build_bulb, None),
    "page": (build_page, None),
    "chai": (build_chai, None),
    "terraces-light": (lambda: build_terraces("light"), (3200, 1300)),
    "terraces-dark": (lambda: build_terraces("dark"), (3200, 1300)),
}


GROUNDED = {"campus", "booth", "chai"}


def bounds():
    """World-space centre and radius of everything visible (the floor excluded)."""
    bpy.context.view_layer.update()
    pts = []
    for o in bpy.context.scene.objects:
        if o.type in {"MESH", "CURVE", "FONT"} and o.name != "Floor":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    # The first set was framed at 0.82; long objects need the whole sphere (export trims the margin).
    tight = 0.82 if bpy.context.scene.get("tight_frame") else 1.0
    return centre, max((p - centre).length for p in pts) * tight


FIRST_SET = {"seal", "commit", "rosette", "envelope"} | {f"medallion-{t}" for t in ["raw", "spark", "flare", "shine", "radiant", "luminary"]}


def render(name):
    build, dims = JOBS[name]
    width, height = dims or (args.size, args.size)
    reset_scene(width, height)
    bpy.context.scene["tight_frame"] = name in FIRST_SET
    world()
    obj, radius = build()
    if name.startswith("terraces"):
        target = (6.0, 0, 2.1)
        camera((6.0, -16.5, 7.0), target, lens=37)
        studio(target, scale=2.2)
        bpy.context.scene.view_settings.exposure = -1.0
    elif name.startswith("tray"):
        target = (0, 0, 0.25)
        camera((0.4, -6.6, 5.0), target, lens=62)
        studio(target, scale=1.3)
        bpy.context.scene.view_settings.exposure = -1.1
    else:
        centre, radius = bounds()
        fov = 2 * math.atan(18 / 85)
        distance = radius * 1.08 / math.tan(fov / 2)
        # Things that stand on the ground are seen from a little higher, like a model on a table.
        lift = 0.5 if name in GROUNDED else 0.28
        camera(centre + Vector((0, -distance * 0.94, distance * lift)), centre, lens=85)
        studio(tuple(centre))
    if args.project:
        project(name, width, height)
        return
    bpy.context.scene.render.filepath = f"{args.out}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"rendered {name}")


def project(name, width, height):
    """Where each step's top centre and the marker land in the render, in pixels from the top left."""
    import json
    from bpy_extras.object_utils import world_to_camera_view

    scene = bpy.context.scene
    bpy.context.view_layer.update()
    points = {}
    def top_centre(o):
        meshes = [o] + [c for c in o.children_recursive if c.type == "MESH"]
        pts = [m.matrix_world @ Vector(c) for m in meshes if m.type == "MESH" for c in m.bound_box]
        return Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), max(p.z for p in pts)))

    for o in scene.objects:
        if o.name.startswith("inlay-") or o.name == "marker":
            uv = world_to_camera_view(scene, scene.camera, top_centre(o))
            points[o.name.replace("inlay-", "")] = [round(uv.x * width, 1), round((1 - uv.y) * height, 1)]
    with open(f"{args.out}/{name}.points.json", "w") as f:
        json.dump({"width": width, "height": height, "points": points}, f, indent=1)
    print(f"projected {name}: {points}")


names = [n for n in args.only.split(",") if n] or list(JOBS)
for n in names:
    render(n)
