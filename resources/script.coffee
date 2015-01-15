---
# Main scripts
---

locked = false

$(document).ready ->
    $("h2").click ->
        if not locked
            load_screen $(this).data "name"

    $("<div>")
        .addClass "back"
        .html "[&larr; Go Back]"
        .appendTo ".content"
        .click ->
            reset_screen()

    if window.location.hash
        load_screen window.location.hash[1...]
    else
        reset_screen()

reset_screen = ->
    window.location.hash = ""
    $(".active").removeClass "active"
    $(".hide").removeClass "hide"
    $(".header").css opacity: 1

load_screen = (name) ->
    locked = true
    reset_screen()
    window.location.hash = name
    $(".header").css opacity: 0
    $(".section.#{name}").addClass "active"
    $(".section:not(.active)").addClass "hide"
    locked = false