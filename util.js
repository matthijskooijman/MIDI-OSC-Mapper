function visitWidgets(widgets, callback) {
    let new_widgets = []
    for (let widget of widgets) {
        if (widget.type == "panel") {
            if ("widgets" in widget)
                widget.widgets = visitWidgets(widget.widgets, callback)
            if ("tabs" in widget)
                widget.tabs = visitWidgets(widget.tabs, callback)
            new_widgets.push(widget)
        } else {
            let result = callback(widget)
            if (Array.isArray(result))
                new_widgets.push(...result)
            else if (result)
                new_widgets.push(result)
        }
    }
    return new_widgets
}

function widgetToControl(widget) {
    let attrs
    if (widget.type == 'fader' || widget.type == 'knob') {
        attrs = {
            type: 'fader',
            range: widget.range,
        }
    } else if (widget.type == 'button') {
        attrs = {
            type: 'button',
            mode: widget.mode,
            on: widget.on,
            off: widget.off,
        }
    } else if (widget.type == 'text') {
        attrs = {
            type: 'text',
        }
    } else {
        console.error(`widgetToControl: Unsupported widget id=${widget.id}, type=${widget.type}`)
        return null
    }
    attrs['address'] = widget.address
    attrs['preArgs'] = widget.preArgs
    // These are control attributes only, unused by the widget itself
    attrs['onSend'] = widget.onSend
    attrs['onReceive'] = widget.onReceive
    return attrs
}

function controlsFromWidgets(widgets, surface) {
    visitWidgets(widgets, (widget) => {
        surface.addControl(widget.id, widgetToControl(widget))
    })
}

function insertBeforeWidget(widgets, id, to_insert) {
    if (!Array.isArray(to_insert))
        to_insert = [to_insert]
    return visitWidgets(widgets, (widget) => {
        if (widget.id == id)
            return [...to_insert, widget]
        else
            return widget
    })
}

function insertAfterWidget(widgets, id, to_insert) {
    if (!Array.isArray(to_insert))
        to_insert = [to_insert]
    return visitWidgets(widgets, (widget) => {
        if (widget.id == id)
            return [widget, ...to_insert]
        else
            return widget
    })
}

module.exports = {
    widgetToControl,
    visitWidgets,
    controlsFromWidgets,
    insertBeforeWidget,
    insertAfterWidget,
    enumLookup: (enumClass, valueToFind) => {
        let entry = Object.entries(enumClass).find(([name, value]) => (value == valueToFind))
        if (entry !== undefined)
            return entry[1]
        else
            return "<Unknown enum value>"
    },
    slugify(str) {
        str = str.replace(/^\s+|\s+$/g, ''); // trim leading/trailing white space
        str = str.toLowerCase(); // convert string to lowercase
        str = str.replace(/[^a-z0-9 -_]/g, '') // remove any non-alphanumeric characters
               .replace(/\s+/g, '_') // replace spaces with underscores
               .replace(/[-_]+/g, '_'); // replace (consecutive) hyphens or underscores with single underscore
        return str;
    }
}
