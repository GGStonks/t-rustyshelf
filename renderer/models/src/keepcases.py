# (T)rustyShelf, Boxshelf beta issue 32: the PS2, Wii, Wii U and GameCube keep cases, modelled from photos of the real
# cases. Run headless:  blender -b -P renderer/models/src/keepcases.py -- renderer/models
# Each case is exported open and flat (the pose renderer/inspect3d.js builds its hinged case in), height 1 = 190 mm:
#   Spine  x in [-D/2, D/2]          the hinge strip, its printed face at z < 0
#   Back   x in [D/2, D/2 + W]       the tray: walls up to z = D - T, the disc hub, the console's moulded marks
#   Lid    x in [-D/2 - W, -D/2]     the front: a low lip and the booklet clips
#   CoverFront / CoverBack / CoverSpine: the printed sheet's parts, outside each panel (UVs 0..1, read from outside)
#   DiscDock / BookletDock: empties where the disc and the booklet sit
# Inspect3D puts Lid, Spine and Back on its own hinge pivots, so the case opens and shuts as the built one does.
import bpy, bmesh, math, sys, os

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'
H, W = 1.0, 135 / 190          # height, width
D = 14 / 190                    # closed thickness
T = 1.6 / 190                   # panel thickness
WALL = 1.4 / 190                # wall thickness
HALF = D / 2 - T                # each half's walls: lid and tray are mirror halves, shut they meet in the middle (14 mm)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=.45, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)


def rrect(cx, cy, w, h, r, seg=6):
    """a rounded rectangle's outline, counter-clockwise"""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4); pts = []
    for (ax, ay, a0) in ((cx + w / 2 - r, cy - h / 2 + r, -90), (cx + w / 2 - r, cy + h / 2 - r, 0), (cx - w / 2 + r, cy + h / 2 - r, 90), (cx - w / 2 + r, cy - h / 2 + r, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); pts.append((ax + r * math.cos(a), ay + r * math.sin(a)))
    return pts


def obj_from_bm(name, bm, material, parent):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material); ob.parent = parent
    for p in me.polygons: p.use_smooth = False
    return ob


def prism(name, pts, z0, z1, material, parent):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]; hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(list(reversed(lo))); bm.faces.new(hi)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)


def ring(name, outer, inner, z0, z1, material, parent):
    """a wall: the band between two outlines with the same number of points"""
    bm = bmesh.new(); n = len(outer)
    ol = [bm.verts.new((x, y, z0)) for x, y in outer]; oh = [bm.verts.new((x, y, z1)) for x, y in outer]
    il = [bm.verts.new((x, y, z0)) for x, y in inner]; ih = [bm.verts.new((x, y, z1)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ol[i], ol[j], oh[j], oh[i])); bm.faces.new((il[j], il[i], ih[i], ih[j]))
        bm.faces.new((oh[i], oh[j], ih[j], ih[i])); bm.faces.new((ol[j], ol[i], il[i], il[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)


def cyl(name, x, y, r, z0, z1, material, parent, seg=40, r1=None):
    bm = bmesh.new(); r1 = r if r1 is None else r1
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r1, depth=z1 - z0)
    for v in bm.verts: v.co.x += x; v.co.y += y; v.co.z += (z0 + z1) / 2
    return obj_from_bm(name, bm, material, parent)


def tube(name, x, y, r0, r1, z0, z1, material, parent, seg=64, a0=0, a1=360):
    """a round wall (or an arc of one): radius r0..r1"""
    full = a1 - a0 >= 360; n = seg if full else max(4, int(seg * (a1 - a0) / 360))
    pts = lambda r: [(x + r * math.cos(math.radians(a0 + (a1 - a0) * i / (n if full else n))), y + r * math.sin(math.radians(a0 + (a1 - a0) * i / (n if full else n)))) for i in range(n if full else n + 1)]
    if full:
        return ring(name, pts(r1), pts(r0), z0, z1, material, parent)
    o, i = pts(r1), pts(r0)
    return prism(name, o + list(reversed(i)), z0, z1, material, parent)


def box(name, x, y, w, h, z0, z1, material, parent, r=0.0):
    return prism(name, rrect(x, y, w, h, r, 3) if r else [(x - w / 2, y - h / 2), (x + w / 2, y - h / 2), (x + w / 2, y + h / 2), (x - w / 2, y + h / 2)], z0, z1, material, parent)


def text(name, s, x, y, size, z0, z1, material, parent, bold=True):
    bpy.ops.object.text_add(location=(x, y, z0))
    t = bpy.context.object; t.data.body = s; t.data.size = size; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    t.data.extrude = (z1 - z0) / 2; t.location.z = (z0 + z1) / 2
    bpy.ops.object.convert(target='MESH'); t.name = name; t.data.materials.clear(); t.data.materials.append(material); t.parent = parent
    return t


def sheet(name, x0, x1, inset, z, material, parent):
    """a printed part of the sheet, facing out (-z), its picture upright when you look at it from outside"""
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    y0, y1 = -H / 2 + inset, H / 2 - inset
    vs = [bm.verts.new((x1, y0, z)), bm.verts.new((x0, y0, z)), bm.verts.new((x0, y1, z)), bm.verts.new((x1, y1, z))]
    f = bm.faces.new(vs)  # wound so its normal points to -z
    for loop, (u, v) in zip(f.loops, ((0, 1), (1, 1), (1, 0), (0, 0))):  # (glTF keeps v top-down: three.js shows it upright)
        loop[uv].uv = (u, v)
    if f.normal.z > 0: f.normal_flip()
    return obj_from_bm(name, bm, material, parent)


def empty(name, loc, parent):
    e = bpy.data.objects.new(name, None); e.location = loc; e.parent = parent; bpy.context.collection.objects.link(e); return e


def build(key, color, rc, hub, logo, clips, extras=lambda M, L, B: None, hubY=0.0, lid_extras=None, seat=True):
    clear()
    shell = mat('Shell', srgb(color), rough=.48)
    lighter = tuple(min(1, c * 1.25 + .01) for c in srgb(color))
    logoM = mat('Logo', lighter, rough=.6)
    hubM = mat('Hub', srgb(hub.get('color', color)), rough=.4)
    covF, covB, covS = mat('CoverFront', (1, 1, 1), .55), mat('CoverBack', (1, 1, 1), .55), mat('CoverSpine', (1, 1, 1), .55)
    root = empty('Case_' + key, (0, 0, 0), None)
    L, S, B = empty('Lid', (0, 0, 0), root), empty('Spine', (0, 0, 0), root), empty('Back', (0, 0, 0), root)
    bx, lx = D / 2 + W / 2, -D / 2 - W / 2  # panel centres
    # the spine strip and its two moulded ridges
    box('Spine_Plate', 0, 0, D, H, -T, 0, shell, S)
    for sx in (-D / 4, D / 4):
        box('Spine_Ridge', sx, 0, 1.0 / 190, H - .05, 0, .0015, shell, S)
    # the back tray: plate, walls on its three free sides, the edge it shares with the spine open
    prism('Back_Plate', rrect(bx, 0, W, H, rc), -T, 0, shell, B)
    ring('Back_Wall', rrect(bx, 0, W, H, rc), rrect(bx, 0, W - 2 * WALL, H - 2 * WALL, max(.002, rc - WALL)), 0, HALF, shell, B)
    # the lid: its mirror half, the same walls
    prism('Lid_Plate', rrect(lx, 0, W, H, rc), -T, 0, shell, L)
    ring('Lid_Wall', rrect(lx, 0, W, H, rc), rrect(lx, 0, W - 2 * WALL, H - 2 * WALL, max(.002, rc - WALL)), 0, HALF, shell, L)
    # the disc seat: the raised ring the disc rests on, and the hub
    cy = hubY; R = hub['ring']
    if seat:
        tube('Back_DiscRing', bx, cy, R, R + 2.0 / 190, 0, 1.6 / 190, shell, B)
        for i, a in enumerate((45, 135, 225, 315)):  # the finger dips cut into the ring
            tube('Back_Dip', bx, cy, R - 6 / 190, R + 3 / 190, 0, .6 / 190, logoM, B, a0=a - 12, a1=a + 12)
    hub['make'](bx, cy, hubM, shell, B)
    # moulded marks, booklet clips
    for (s, x, y, size) in logo:
        text('Back_Logo', s, bx + x, y, size, 0, .7 / 190, logoM, B)
    for (side, y, w, h) in clips:
        if side == 'lid':
            box('Lid_Clip', lx - W / 2 + WALL + w / 2, y, w, h, 0, 3.5 / 190, shell, L, r=.004)
        else:
            box('Back_Clip', bx + W / 2 - WALL - w / 2, y, w, h, 0, 5 / 190, shell, B, r=.003)
    extras(shell, logoM, B)
    if lid_extras: lid_extras(shell, logoM, L)
    # every moulded edge softly rounded, as injection-moulded plastic is (the printed sheet and the lettering stay sharp)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and not o.name.startswith(('Cover', 'Back_Logo', 'Logo')) and o.data.materials and o.data.materials[0].name in ('Shell', 'Hub'):
            bv = o.modifiers.new('Bevel', 'BEVEL'); bv.width = .35 / 190; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40); bv.harden_normals = False
    # the printed sheet, just outside the plastic
    z = -T - .0008
    sheet('CoverFront', -D / 2 - W + .006, -D / 2 - .004, .006, z, covF, L)
    sheet('CoverBack', D / 2 + .004, D / 2 + W - .006, .006, z, covB, B)
    sheet('CoverSpine', -D / 2 + .002, D / 2 - .002, .006, z, covS, S)
    empty('DiscDock', (bx, cy, 3.2 / 190), B)
    empty('BookletDock', (lx, 0, 1.2 / 190), L)
    os.makedirs(OUT, exist_ok=True)
    f = os.path.join(OUT, 'case-%s.glb' % key)
    bpy.ops.export_scene.gltf(filepath=f, export_format='GLB', export_yup=False, export_apply=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    print('wrote', f, sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'), 'faces')


# --- the hubs ---------------------------------------------------------------------------------------------------------
def hub_y(arms_color_m=None):
    """the Amaray hub: a round button on a collar, three arms that grip the disc's hole (PS2, Wii)"""
    def make(x, y, hubM, shell, P):
        cyl('Hub_Collar', x, y, 13 / 190, 0, 1.4 / 190, shell, P)
        cyl('Hub_Post', x, y, 7.5 / 190, 0, 4.5 / 190, hubM, P, r1=7.0 / 190)
        for a in (90, 210, 330):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1)
            for v in bm.verts:
                v.co.x *= 9 / 190; v.co.y *= 3.2 / 190; v.co.z *= 2.2 / 190
                v.co.x += 7.5 / 190; v.co.z += 4.2 / 190
                xx, yy = v.co.x, v.co.y; v.co.x = x + xx * ca - yy * sa; v.co.y = y + xx * sa + yy * ca
            obj_from_bm('Hub_Arm', bm, hubM, shell and P)
    return make


def hub_rosette(n=8):
    """Nintendo's rosette (Wii U): petals round a centre cap"""
    def make(x, y, hubM, shell, P):
        cyl('Hub_Collar', x, y, 12 / 190, 0, 1.4 / 190, shell, P)
        for i in range(n):
            a = 360 * i / n
            tube('Hub_Petal', x, y, 3.5 / 190, 8 / 190, 0, 4.2 / 190, hubM, P, a0=a + 4, a1=a + 360 / n - 4)
        cyl('Hub_Cap', x, y, 3.4 / 190, 0, 4.6 / 190, hubM, P)
    return make


def hub_minidisc():
    """the GameCube's: a small post for the 8 cm disc, and eight pads in a ring round it"""
    def make(x, y, hubM, shell, P):
        cyl('Hub_Post', x, y, 4.2 / 190, 0, 4.8 / 190, hubM, P)
        cyl('Hub_Collar', x, y, 7.5 / 190, 0, 1.6 / 190, shell, P)
        for i in range(8):
            a = 360 * i / 8 + 22.5
            tube('Hub_Pad', x, y, 36 / 190, 43 / 190, 0, 2.6 / 190, hubM, P, a0=a - 14, a1=a + 14)
    return make


# --- the PS2 case, from a photo of an open one ----------------------------------------------------------------------
MM = 1 / 190


def rbox(name, x, y, w, h, ang, z0, z1, material, parent):
    """a box turned by ang degrees about its middle"""
    c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = [(x + px * c - py * s_, y + px * s_ + py * c) for px, py in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    return prism(name, pts, z0, z1, material, parent)


def ps_symbol(x, y, size, z0, z1, material, parent):
    """the PlayStation mark moulded into the tray: the upright P, and the S lying flat in front of it"""
    p = text('Back_Logo_P', 'P', x - size * .12, y + size * .08, size, z0, z1, material, parent)
    sx = text('Back_Logo_S', 'S', x + size * .05, y - size * .22, size * .9, z0, z1 * .8, material, parent)
    sx.scale = (1.35, .42, 1); sx.rotation_euler = (0, 0, math.radians(-8))
    bpy.context.view_layer.objects.active = sx; sx.select_set(True); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); sx.select_set(False)


def ps2_back(shell, logoM, B):
    bx, cy = D / 2 + W / 2, -.035
    ps_symbol(bx, .385, .085, 0, .9 * MM, logoM, B)
    # the disc seat: a low rim round the disc, a broad crescent above it and two short shoulders below (where the case
    # holds the disc's edge), all one moulding with the tray
    R = 60.5 * MM
    tube('Back_SeatRim', bx, cy, R, R + 1.8 * MM, 0, 2.2 * MM, shell, B, seg=96)
    for a0, a1 in ((22, 78), (102, 158)):  # the two raised tabs either side of the top (the photo's upper arcs)
        tube('Back_SeatTab', bx, cy, R - 1 * MM, R + 8 * MM, 0, 3.6 * MM, shell, B, a0=a0, a1=a1)
    for a in (240, 300):
        tube('Back_SeatShoulder', bx, cy, R + 1.8 * MM, R + 6 * MM, 0, 3 * MM, shell, B, a0=a - 14, a1=a + 14)
    tube('Back_SeatFloor', bx, cy, 15 * MM, R, -.15 * MM, .2 * MM, logoM, B, seg=96)  # (the disc's area, a shade lighter)
    # the catches on the opening edge that hold the lid shut
    for y in (.30, -.30):
        box('Back_Catch', bx + W / 2 - WALL - .8 * MM, y, 1.6 * MM, 9 * MM, 0, HALF, shell, B)
        box('Back_CatchLip', bx + W / 2 - WALL - 2.2 * MM, y, 1.4 * MM, 6 * MM, HALF - 2.5 * MM, HALF, shell, B)
    # the stop moulded beside the hinge, top and bottom
    for y in (.44, -.44):
        box('Back_HingeStop', bx - W / 2 + WALL + 2 * MM, y, 4 * MM, 6 * MM, 0, HALF * .8, shell, B)


def ps2_lid(shell, logoM, L):
    lx = -D / 2 - W / 2
    # the two booklet clips on the outer edge: a post on the wall and a sprung finger angled in over the booklet
    for y, ang in ((.355, -28), (-.355, 28)):
        box('Lid_ClipPost', lx - W / 2 + WALL + 3.5 * MM, y, 7 * MM, 15 * MM, 0, HALF * .9, shell, L, r=1 * MM)
        rbox('Lid_ClipFinger', lx - W / 2 + WALL + 13 * MM, y - (6 if y > 0 else -6) * MM, 19 * MM, 4.5 * MM, ang, 2.6 * MM, 5 * MM, shell, L)
        rbox('Lid_ClipTip', lx - W / 2 + WALL + 21 * MM, y - (10.5 if y > 0 else -10.5) * MM, 3.5 * MM, 6 * MM, ang, 1.2 * MM, 5 * MM, shell, L)
    # the matching hinge stops
    for y in (.44, -.44):
        box('Lid_HingeStop', lx + W / 2 - WALL - 2 * MM, y, 4 * MM, 6 * MM, 0, HALF * .8, shell, L)


def ps2_spine(shell):
    S = bpy.data.objects['Spine']
    for y in (.47, -.47):  # the slots at each end of the hinge strip
        box('Spine_Slot', 0, y, D * .6, 3 * MM, 0, 1.2 * MM, shell, S)


def hub_ps2():
    """the PS2 case's hub: a sunken collar, then three wide arms round a post with a small triangular hole"""
    def make(x, y, hubM, shell, P):
        tube('Hub_Collar', x, y, 17 * MM, 20 * MM, 0, 2 * MM, shell, P)
        cyl('Hub_Well', x, y, 17 * MM, -.1 * MM, .3 * MM, hubM, P)
        cyl('Hub_Post', x, y, 7.5 * MM, 0, 5.5 * MM, hubM, P, r1=7 * MM)
        for a in (90, 210, 330):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            pts = [(4.5 * MM, -2.6 * MM), (13 * MM, -4.4 * MM), (15 * MM, -3.4 * MM), (15 * MM, 3.4 * MM), (13 * MM, 4.4 * MM), (4.5 * MM, 2.6 * MM)]
            prism('Hub_Arm', [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts], 2.8 * MM, 5.2 * MM, hubM, P)
        hole = mat('HubHole', (0.005, 0.005, 0.006), rough=.8)
        prism('Hub_Hole', [(x + 2.4 * MM * math.cos(math.radians(a)), y + 2.4 * MM * math.sin(math.radians(a))) for a in (90, 210, 330)], 5.5 * MM, 5.9 * MM, hole, P)
    return make


build('ps2', '#141518', rc=.02, hub=dict(ring=61 / 190, make=hub_ps2(), color='#1b1c20'), logo=[], seat=False, hubY=-.035,
      clips=[], extras=lambda shell, logoM, B: (ps2_back(shell, logoM, B), ps2_spine(shell)), lid_extras=ps2_lid)
build('wii', '#eef0f2', rc=.022, hub=dict(ring=61 / 190, make=hub_y(), color='#dfe8f5'), logo=[('Wii', 0, .40, .085)],
      clips=[('back', .30, .022, .07), ('back', -.30, .022, .07)])
build('wiiu', '#2a9bd4', rc=.045, hub=dict(ring=61 / 190, make=hub_rosette()), logo=[('Nintendo', 0, .405, .05)],
      clips=[('lid', .36, .07, .045), ('lid', -.36, .07, .045), ('back', .30, .02, .06), ('back', 0, .02, .06), ('back', -.30, .02, .06)],
      extras=lambda shell, logoM, B: ring('Back_LogoFrame', rrect(D / 2 + W / 2, .405, .22, .055, .025), rrect(D / 2 + W / 2, .405, .21, .045, .02), 0, .6 / 190, logoM, B))


def gc_extras(shell, logoM, B):
    bx = D / 2 + W / 2
    # the memory card holder at the top: a frame and two small catches
    ring('Back_CardFrame', rrect(bx, .33, .2, .13, .006), rrect(bx, .33, .186, .116, .004), 0, 3.4 / 190, shell, B)
    for sx in (-.07, .07):
        box('Back_CardCatch', bx + sx, .27, .025, .012, 0, 4.2 / 190, shell, B)
    box('Back_Rib', bx, .2, .16, .012, 0, 1.2 / 190, logoM, B)


build('gc', '#3a393e', rc=.016, hub=dict(ring=46 / 190, make=hub_minidisc(), color='#4a4950'), logo=[('NINTENDO', 0, -.36, .04), ('GAMECUBE', 0, -.405, .055)],
      clips=[('lid', .33, .075, .07), ('lid', -.33, .075, .07)], extras=gc_extras, hubY=-.02)
