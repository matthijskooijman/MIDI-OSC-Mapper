OSC-MIDI mapper
===============
This is a module for the open-stage-control software, that allows
mapping MIDI message from control surfaces to OSC (open *sound* control)
messages. This was written for the usecase of using a Behringer X-touch
control surface to control Ardour through OSC, but with an appropriate
mapping defined, should also be useful for other control surfacs and
possibly other DAW or other software that supports OSC.


Setup
-----
 - [Install Open Stage Control](https://openstagecontrol.ammd.net/download/)
 - Clone this repository anywhere. Pass `--recurse-submodules` to `git
   clone` (or run `git submodule update --init` after cloning) to also
   clone the submodule needed.
 - Configure ardour to enable OSC (default settings are fine).
 - Start open-stage-control with something like:

   ```
   open-stage-control --debug --midi xtouch:x-touch,x-touch icon:icon,icon --custom-module mapper.js --send 127.0.0.1:3819 --no-gui
   ```

   This sets up two midi devices, e.g. one named xtouch that uses input
   and output ports with "x-touch" in their name, one named "icon" with
   ports with "icon" in their name. Adapt to your needs, run
   `open-stage-control --midi list` to get a list of ports.

   It also sets up an OSC connection to Ardour on the default OSC port.

   Finally, this does not set up or even show a open-stage-control GUI,
   since this really just uses open-stage-control for OSC and midi
   input and output, though adding a bit of GUI (e.g. to show some
   additional state about the control surface) can be a future addition.

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


TODO
 - Maybe use an OSC UI with widgets to do the mapping. Create (hidden?) widgets
   for all possible ardour controls, and (visible?) widgets for all
   xtouch controls. Then use linkID to connect them depending on the
   mode. This UI can also serve as an indicator of the current mode and
   to show the function of encoders/buttons.

   The ardour widgets can then store feedback values even when not
   linked/active. When setting linkid to a control, it will force its
   value on existing controls with the same linkid (so the ardour
   widgets must have their linkId modified to point to the xtouch
   widgets).

   This could share code wit the virtual xtouch maybe?
 - Make sure that the mode-switching is flexible enough to implement
   send-to-fader (for reverb mutes and level). Does this work with
   Ardour-based banking, or should we implement banking ourselves then?
