# foxglove-livox-extension

A [Foxglove](https://foxglove.dev) extension that shows Livox LiDAR point clouds published as `livox_ros_driver2/msg/CustomMsg` in Foxglove's 3D panel.

It is also a minimal example of how to write a Foxglove **message converter** extension: the whole extension is one file, [`src/index.ts`](src/index.ts).

## Why this is needed

[`livox_ros_driver2`](https://github.com/Livox-SDK/livox_ros_driver2) can publish point clouds in two formats, chosen by the `xfer_format` launch parameter:

| `xfer_format` | Message type | Shows up in Foxglove's 3D panel? |
|---|---|---|
| `0` | `sensor_msgs/msg/PointCloud2` | Yes, Foxglove supports it out of the box |
| `1` | `livox_ros_driver2/msg/CustomMsg` | No, Foxglove does not know this type |

`CustomMsg` is often the one you want, for example because FAST-LIO and other Livox-based SLAM stacks expect it. This extension converts it on the fly to `foxglove.PointCloud`, so the topic can be displayed like any other point cloud.

## How it works

```
ROS 2 side                                          Foxglove side
──────────                                          ─────────────
livox_ros_driver2 ──CustomMsg──► foxglove_bridge ──► Foxglove app
(or Isaac Sim)                   (or an MCAP file)      └─ this extension:
                                                           CustomMsg → foxglove.PointCloud
```

- **The ROS side needs the message definition; the extension does not.** `foxglove_bridge` sends each topic's `.msg` definition to Foxglove, and it reads those definitions from the ROS packages sourced in its environment. Recorded MCAP files carry the definition inside the file.
- **The extension is plain TypeScript.** It is built with npm, needs no ROS installation, and can be built on any OS.
- **The schema name is the only link between the two.** The converter is registered for `livox_ros_driver2/msg/CustomMsg`, so it applies to any topic with that type, whichever package provides the message.

## Requirements

**ROS 2 machine.** `foxglove_bridge` must run in a shell where a package providing `livox_ros_driver2/msg/CustomMsg` is built and sourced. That package is one of:

- the full [`livox_ros_driver2`](https://github.com/Livox-SDK/livox_ros_driver2) driver, for a real sensor;
- a messages-only copy (`CustomMsg.msg` and `CustomPoint.msg` in a package also named `livox_ros_driver2`), for simulators such as Isaac Sim that only need the message types.

Use one or the other. They have the same package name, so colcon will refuse to build a workspace that contains both.

**Extension build machine.** You need Node.js 18.18 or newer (22 LTS is recommended) and npm. Ubuntu 22.04's `apt install nodejs` gives Node 12, which is too old. Install a current version with [nvm](https://github.com/nvm-sh/nvm) instead:

```sh
nvm install 22
```

## Usage

### 1. Publish `CustomMsg` and start the bridge (ROS 2 machine)

```sh
source install/setup.bash
ros2 launch livox_ros_driver2 msg_MID360_launch.py      # xfer_format = 1, publishes on /livox/lidar
ros2 launch foxglove_bridge foxglove_bridge_launch.xml  # in another sourced terminal
```

### 2. Build and install the extension (Foxglove machine)

```sh
npm install
npm run local-install
```

`npm run local-install` builds the extension and installs it into the Foxglove desktop app. Restart Foxglove, or press `Ctrl+R` if it is already open.

### 3. View the point cloud

1. Connect Foxglove to the bridge (`ws://<robot-ip>:8765`).
2. Add a **3D** panel and enable the `/livox/lidar` topic.
3. Optionally, set the color mode to **Color by** `reflectivity`.

## How this extension was made

The steps below are the whole process, so you can repeat it for any other custom message type.

**1. Generate the template.**

```sh
npm init foxglove-extension@latest foxglove-livox-extension
cd foxglove-livox-extension
```

The template generates an example custom panel (`src/ExamplePanel.tsx`). This extension doesn't use it, so you can delete it.

**2. Add the Foxglove schema types.**

```sh
npm install @foxglove/schemas
```

**3. Replace `src/index.ts` with a converter.** This is the only file that needs real code. It does three things:

- **Describes the incoming message** with TypeScript types that mirror [`CustomMsg.msg`](https://github.com/Livox-SDK/livox_ros_driver2/blob/master/msg/CustomMsg.msg) and [`CustomPoint.msg`](https://github.com/Livox-SDK/livox_ros_driver2/blob/master/msg/CustomPoint.msg). Foxglove has already decoded the message into a JavaScript object by the time the converter receives it.
- **Packs the points into a binary buffer.** Each point takes 20 bytes:

  | Bytes | Field |
  |---|---|
  | 0–11 | `x`, `y`, `z` (float32) |
  | 12–15 | `offset_time` (uint32) |
  | 16 | `reflectivity` (uint8) |
  | 17 | `line` (uint8) |
  | 18 | `tag` (uint8) |
  | 19 | padding |

  The `fields` array tells Foxglove where each value sits. Points at exactly `(0, 0, 0)` are dropped: they are "no return" points and would otherwise pile up at the sensor origin.
- **Registers the converter** in `activate()`:

  ```ts
  ctx.registerMessageConverter({
    type: "schema",
    fromSchemaName: "livox_ros_driver2/msg/CustomMsg",
    toSchemaName: "foxglove.PointCloud",
    converter: toPointCloud,
  });
  ```

**4. Set the metadata in `package.json`.** Fill in `name`, `displayName`, `publisher`, `version`, `description` and `license`. Foxglove identifies an extension by `publisher` plus `name`.

To adapt this for another message type, change `fromSchemaName`, the input types and the conversion function. Foxglove's [message schemas](https://docs.foxglove.dev/docs/visualization/message-schemas/introduction) list the target types you can convert to.

## Package and publish

```sh
npm run package
```

This creates `<publisher>.foxglove-livox-extension-<version>.foxe`. Install it by dragging it onto the Foxglove window, or attach it to a GitHub release. `.foxe` files are git-ignored.

For publishing to the Foxglove extension registry or to your organization, see the [Foxglove docs](https://docs.foxglove.dev/docs/visualization/extensions/publish/#packaging-your-extension).

## License

MIT. See [LICENSE](LICENSE).
