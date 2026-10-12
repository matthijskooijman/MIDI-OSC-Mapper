OSC-MIDI mapper
===============
This is a module for the open-stage-control software, that allows
mapping MIDI message from control surfaces to OSC (open *sound* control)
messages. This was written for the usecase of using a Behringer X-touch
control surface to control Ardour through OSC, but with an appropriate
mapping defined, should also be useful for other control surfacs and
possibly other DAW or other software that supports OSC.

This code requires:
 - open-stage-control version 1.27.0 or newer (for the /SESSION/CREATE command).
 - Ardour 8.7 or newer. Also makes use of these unmerged (as of 2026-10) pull requests:
    - https://github.com/Ardour/ardour/pull/901 and
    - https://github.com/Ardour/ardour/pull/897

Setup
-----
 - [Install Open Stage Control](https://openstagecontrol.ammd.net/download/)
 - Clone this repository anywhere. Pass `--recurse-submodules` to `git
   clone` (or run `git submodule update --init` after cloning) to also
   clone the submodule needed.
 - Configure ardour to enable OSC (default settings are fine).
 - Start open-stage-control with something like:

   ```
   open-stage-control --debug --midi xtouch:x-touch,x-touch icon:icon,icon --custom-module ardour-xtouch.js --send 127.0.0.1:3819
   ```

   This sets up two midi devices using `--midi`, e.g. one named xtouch that
   uses input and output ports with "x-touch" in their name, one named "icon"
   with ports with "icon" in their name. Adapt to your needs, run
   `open-stage-control --midi list` to get a list of ports.

   It also sets up an OSC connection to Ardour on the default OSC port using
   `--send`.

   The module loaded defines the setup to use, in this example it contains the
   mappings for using the xtouch surface with the ardour application. This
   command will show a GUI, which shows a virtual copy of the xtouch surface
   that is used to show labels for controls and reflect the current state.

 - To run open-stage-control from a git checkout, you can run this control in its git checkout:

   ```
   npm run start -- --debug --midi xtouch:x-touch,x-touch icon:icon,icon --custom-module /path/to/ardour-xtouch.js --send 127.0.0.1:3819 --port 8082
   ```

Ardour setup
-------------
 - Check Edit -> Preferences -> Control surfaces -> Open Sound Control (OSC)
 - Under Protocol settings defaults are ok (Only needs "Reply on same
   port", the rest will be overwritten on connect anyway).
 - Needs at least one plugin, otherwise init fails

Emulating a control surface
---------------------------

    open-stage-control --midi x-touch:virtual --load virtual-x-touch.json --send midi:x-touch --port 8081

Improved (more complete) version that autogenerates all widges using
a custom module:

    open-stage-control --midi x-touch:virtual --send midi:x-touch --custom-module xtouch.js --load xtouch.json  --debug

This creates a virtual midi device named `x-touch` with two parts, named
`midi_in` and `midi_out`. They are shown as such in `open-stage-control
--midi list`. In QLCplus (after restart) only the port names are shown.

TODO:
 - Different layers (a/b/mackie). Idea: Pass layername around to
   widget-generating functions and use to prefix the widget ids and add
   an offset to the midi messages.
 - Buttons on the encoders. OSC knobs cannot also be buttons, so maybe
   create a panel with a knob and a button absolutely positioned over
   the knob?
 - Better match layout (button sizes and overally aspect ratio) to
   actual xtouch.
 - Add icons to control buttons on the right.
 - Add touch events to faders? Seems there is an onTouch event handler,
   maybe that have JS to emit these events?

Status
------
This repository currently contains a very rough initial prototype, where
the basics work, but the mapping configuration is still very much
incomplete and feedback does not work in all cases yet.

This repo also serves two purposes: Making something that works for me
personally to make my work in Ardour easier, and explore how a mapping
configuration format can be made expressive enough to cover even more
advanced cases (for which Ardour currently has specific code to support
specific control surfaces). Maybe this will eventually evolve into
a polished tool to use alongside others, but ideally Ardour's control
surface mapping will be made more flexible and this tool can become
obsolete.

Ardour interface
----------------

### Startup sequence
In `ardour.js`:
 - On load/reload, a `/set_surface` is sent to register and configure as
   a surface with ardour. This triggers feedback with current values for
   various strip controls.
 - After a short time, `/strip/list` is sent to query the full list of
   available strips.
 - For each strip this query returns, appropriate controls are added and
   `strip/plugin/list` is sent to query the full list of plugins for
   that strip.
 - For each plugin this query returns, some info is stored in
   `plugin_info`, and a `/strip/plugin/descriptor` query is sent to
   retrieve all plugin parameters.
 - For each parameter this query returns, info is stored
   in `plugin_info` and appropriate controls are added.
 - Once all parameters are queried, the `init_complete()` callback is
   called.

All this relies on the fact that ardour processes queries one by one and
queues replies for one query before processing the next query (so we can
assume that replies to an earlier query will be received before replies
to a later query).

In `ardour-xtouch.js`, on program startup:
 - When an osc client (UI) connects, a `/SESSION/CREATE` command is sent
   to create a new, empty, session.
 - When the session is created, and the ardour initialization is also
   complete (`init_complete` callback called), further initialization
   (setting up the UI, setting up virtual controls, setting up control
   links) is done and the system is operational.

On a reload, the session is assumed to be created already, so further
initialization is done as soon as ardour is done.
