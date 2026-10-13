"use strict";

var util = require('./util.js')

// These are predefined by open-stage-control. Declare them again to
// prevent tsserver check errors. Assign them to themselves to prevent
// "possibly 'undefined'" errors.
var send = send
var receive = receive
var app = app
var settings = settings

class Control {
    type
    id
    range
    address
    preArgs

    constructor(id, attrs) {
        this.id = id
        Object.assign(this, attrs)

        this.preArgs = this.preArgs ?? []

        // Adding these defaults explicitly here makes the rest of the code
        // easier to write
        if (this.type == "button") {
            this.on = this.on ?? 1
            this.off = this.off ?? 0
        } else if (this.type == "fader") {
            this.range = this.range ?? {}
            this.range.min = this.range.min ?? 0
            this.range.max = this.range.max ?? 1
        }
    }

    scaleValue(to, value) {
        let normalized = (value - this.range.min) / (this.range.max - this.range.min)
        //console.debug(value, normalized, this, to)
        return normalized * (to.range.max - to.range.min) + to.range.min
    }

    matchAddress(address, args) {
        if (address != this.address)
            return false
        if (args.length != this.preArgs.length + 1)
            return false
        if (!this.preArgs.every((v,i)=> v === args[i].value))
            return false
        return args[this.preArgs.length].value;
    }
}

class SurfaceControl extends Control {
    link
    onSend
    onReceive

    constructor(id, surface, {onSend = undefined, onReceive = undefined, ...params}) {
        super(id, params)
        this.surface = surface
        // TODO: Should onSend and onReceive just be an event emitter
        // for less code duplication and allow multiple listeners
        this.onSend = onSend
        this.onReceive = onReceive
    }

    processValue(value) {
        if (this.onReceive)
            this.onReceive(value)

        if (this.link) {
            console.debug(`Forwarding surface control id=${this.id} to app id=${this.link.app_control.id}, value=${value}`)

            let app_control = this.link.app_control
            if (this.type == 'fader') {
                app_control.sendValue(this.scaleValue(app_control, value))
            } else if (this.type == 'button') {
                // TODO: Turns out momentary (default) buttons on xtouch
                // do 1 then 0 for a single press, so that needs to ignore the
                //   release (0). Needs configuration after all.
                // Can be changed to toggle, then it only sends
                // the inverse of the last feedback value on press
                // (nothing on release)
                // Extra problem of momentary is that the led goes off
                // when you release, so we would need to send another
                // "on" feedback message after receiving the off message
                // from the surface to keep it on.
                // So buttons in "toggle" mode is probably better, but
                // not default...
		// Update: Handle this with a separate tap and release property on the app control instead?

                // TODO: Should this use link.tap instead?
                let tap_value = app_control.tap ?? this.link.on_value
                let release_value = app_control.release ?? 0
                if (tap_value === undefined && release_value === undefined && value) {
                    // No tap and release, so assume this is a toggling state, so invert the
                    // current app state and send that.
                    // This assumes that any value not off is on
                    let is_on = (app_control.value != app_control.off)
                    let toggled_value = is_on ? app_control.off : app_control.on

                    app_control.sendValue(toggled_value)
                } else if (tap_value !== undefined && value) {
                    // If a tap_value is set, always just send that
                    app_control.sendValue(tap_value)
                } else if (release_value !== undefined && !value) {
                    app_control.sendValue(release_value)
		}
            } else {
                console.warn("forward_to_app: Unsupported control type: " + app_control.type)
            }
        }
    }

    sendValue(value) {
        if (this.onSend)
            this.onSend(value)

        this.surface.send(this.address, ...this.preArgs, value)
    }

    // Should only be called by AppControl
    replaceLink(link) {
        this.unlink()
        this.link = link
    }

    unlink() {
        if (this.link)
            this.link.app_control.links = this.link.app_control.links.filter(v => v !== this.link)
        this.link = undefined
    }
}

class AppControl extends Control {
    links = []
    onSend
    onReceive

    constructor(id, app, {onSend = undefined, onReceive = undefined, ...params}) {
        super(id, params)
        this.onSend = onSend
        this.onReceive = onReceive
        this.app = app
    }

    // TODO: Maybe move both processValues into Link?
    processValue(value) {
        console.debug(`Storing app control value id=${this.id}, value=${value}`)
        this.value = value

        if (this.onReceive)
            this.onReceive(value)

        for (let link of this.links) {
            console.debug(`Forwarding app control id=${this.id} to surface id=${link.surface_control.surface.name}:${link.surface_control.id}, value=${value}`)
            let surface_control = link.surface_control
            if (surface_control.type == 'button') {
                let is_on
                if (link.on_value !== undefined) {
                    is_on = (value == link.on_value)
                } else {
                    // Assume anything not off is on
                    is_on = (value != this.off)
                }
                let surface_value = is_on ? surface_control.on : surface_control.off
                surface_control.sendValue(surface_value)
            } else if (surface_control.type == 'fader') {
                surface_control.sendValue(this.scaleValue(surface_control, value))
            } else if (surface_control.type == 'text') {
                surface_control.sendValue(value)
            } else {
                console.warn("forward_to_surface: Unsupported control type: " + this.type)
            }
        }
    }

    sendValue(value) {
        if (this.onSend)
            this.onSend(value)

        // Virtual controls might not have an address
        if (this.address) {
            this.app.send(this.address, ...this.preArgs, value)
        } else {
            // Virtual controls have no address, but pretend they are
            // sent to the application and the sent value is returned
            // as-is, so feedback is sent to the surface and the value
            // can be queried back later.
            // TODO: For some virtual controls this is not appropriate
            // (e.g. bank_down, which has its feedback value externally
            // controlled). Maybe have onSend indicate that the value
            // has been handled?
            this.processValue(value)
        }
    }

    addLinkTo(surface_control, params) {
        let link = new Link({app_control: this, surface_control, params})
        surface_control.replaceLink(link)
        this.links.push(link)
        if (this.value !== undefined)
            this.processValue(this.value)
    }
}

class Link {
    on_value

    constructor({app_control, surface_control, params}) {
        this.app_control = app_control
        this.surface_control = surface_control
        Object.assign(this, params)
    }
}

class ControlContainer {
    controls = {}

    addControl(control) {
        this.controls[control.id] = control
    }

    findMatchingControl(address, args) {
        for (const control of Object.values(this.controls)) {
            let value = control.matchAddress(address, args)
            if (value !== false) {
                //console.debug(`Matched control ${control.id}`, address, args)
                return [control, value]
            }
        }
        return [false, false]
    }


    processMessage(address, args) {
        //console.debug("processMessage:", address, args)
        let [control, value] = this.findMatchingControl(address, args)
        if (control) {
            control.processValue(value)
            return true
        }
        return false
    }

    getControl(id) {
        return this.controls[id]
    }
}

class Surface extends ControlContainer {
    controls = {}

    constructor({target}) {
        super()
        this.target = target
    }

    addControl(id, attrs) {
        super.addControl(new SurfaceControl(id, this, attrs))
    }

    send(address, ...args) {
        //console.debug(`${this.name}: Sending ${address}, ${args}`)
        send(...this.target, address, ...args)
    }

    get name() {
        return this.target[1]
    }

    unlink(id) {
        this.getControl(id).unlink()
    }
}

class Application extends ControlContainer {
    constructor({target}) {
        super()
        this.target = target;
    }

    addControl(id, attrs) {
        super.addControl(new AppControl(id, this, attrs))
    }

    send(address, ...args) {
        send(...this.target, address, ...args)
    }

    addLink(app_control_id, ...links) {
        let app_control = this.controls[app_control_id]

        if (app_control === undefined) {
            console.warn(`Trying to link unknown app control id=${app_control_id}`)
            return
        }

        for (let link of links) {
            let [surface, id, params={}] = link
            let surface_control = surface.controls[id]
            if (surface_control === undefined) {
                console.warn(`Trying to link unknown surface control surface=${surface.name}, id=${id}`)
                return
            }

            if (app_control.type != surface_control.type && (surface_control.type != 'button' || params.on_value === undefined)) {
                console.warn(`Trying to link mismatched controls, app id=${app_control.id}, type=${app_control.type }, surface=${surface.name}, id=${surface_control.id}, type=${surface_control.type}, params=`, params)
                return
            }

            app_control.addLinkTo(surface_control, params)

            if (params.widget) {
                // This assumes that surface is a UiSurface that supports this method
                surface.setWidgetAttrs(id, params.widget)
            }
        }
    }

    setControlValue(id, value) {
        this.getControl(id).sendValue(value)
    }

    getControlValue(id) {
        return this.getControl(id).value
    }

    debugLogLinks() {
        for (let control of Object.values(this.controls)) {
            if (control.links.length) {
                // TODO: Params?
                console.debug(`${control.id} linked to:`, control.links.map((link) => `${link.surface_control.surface.name}:${link.surface_control.id}`))
            }
        }
    }

    debugLogControls() {
        for (let control of Object.values(this.controls)) {
            console.debug(control.id, control.address, control.preArgs)
        }
    }
}

// This models an open-stage-control on-screen user interface, which
// behaves mostly as a surface, showing feedback from the app and
// allowing changing parameters.
class UiSurface extends Surface {
    constructor() {
        // These are dummy host/port values to identify messages coming
        // from or going to the ui widgets.
        super({target: ['ui', 'ui']})
    }

    send(address, ...args) {
        // Since the UI is internal, we fake an incoming message which
        // should update the UI
        receive(...this.target, address, ...args)
    }

    replaceWidgets(widgets) {
        this.controlsFromWidgets(widgets)
        this.setWidgetAttrs('root', {widgets: widgets})
    }

    setWidgetAttrs(id, attrs) {
        this.send('/EDIT', id, attrs)
    }

    controlsFromWidgets(widgets) {
        for (let c of Object.values(this.controls))
            c.unlink()
        this.controls = []
        util.visitWidgets(widgets, (widget) => {
            let control = util.widgetToControl(widget)
            this.addControl(widget.id, control)

            widget.target = this.target.join(":")
            // Do not send to default target
            widget.ignoreDefaults = true
            return widget
        })
    }

    unlink(id) {
        // Clear label and other link-configured properties
        // TODO: Do we really neede this? Or should the link manager
        // just manage this?
        /*
        let link = this.getControl(id).link
        console.debug("unlink", id, link)
        if (link !== undefined && link.widget) {
            let attrs = {}
            for (let key in link.widget)
                attrs[key] = ""
            this.setWidgetAttrs(id, attrs)
        }
        */
        super.unlink(id)
    }
}

module.exports = {
    Application,
    Surface,
    UiSurface,
}
