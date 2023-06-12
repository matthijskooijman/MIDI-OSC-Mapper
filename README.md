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
