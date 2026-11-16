# Workshop

The Workshop has three columns.

### Left rail

- **Components**: the catalog, grouped by category and searchable. A coloured dot marks each category; the same colour is used in the viewport and the wiring diagram.
- **Outline**: everything in the build: the case, placed components, geometry features and accessories. Click an item to select it.

### Viewport

![The Workshop](./images/workshop.png)

- **Lid**: *Solid*, *Ghost* (transparent, the default) or *Hidden*.
- **Explode**: lifts the lid and pushes accessories out along their faces.
- **Open lid** (hinged cases only): swings the lid on its hinge, from 0 to 120°.
- **Slide screen** (with a screen slider only): moves the carriage from closed to fully open.
- **Components / Accessories**: toggle their visibility.
- Orbit with the left mouse button, pan with the right, zoom with the wheel. Click empty space to select the case.

Components are drawn as their envelope boxes. A selected component is outlined in the accent colour, and a colliding one in red. Hover over a component to see its name, size and position in the bottom-left corner.

The **Iso / Top / Front / Side** buttons in the top-left corner of the viewport set the camera. Click the active one again to reset the view after orbiting.

### Right rail

- **Inspector**: edits the selection.
- **Checks**: every problem with the build, ranked by severity.

## Severities

The scale is Remora's:

| Severity | Meaning |
|---|---|
| Critical | The build cannot work as designed: a component outside the case, a missing rail, a piece larger than the bed. |
| High | Likely to fail: overloaded converter, collision, missing ports. |
| Medium | Worth fixing: no ventilation, joint blocks under components. |
| Low | Advice. |
| Info | Context, such as how many pieces were split. |

## Coordinates

Millimetres. The origin is the centre of the case footprint, on the floor. **+X** is right, **+Y** is towards the back and **+Z** is up. The front face is −Y.

For a component in the tray, *Lift above floor* raises it; in the lid, *Drop below top* lowers it from the inner ceiling. Rotation turns it in 90° steps around Z.
