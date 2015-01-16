---
# Main scripts
---

currScreen = null
otherScreens = null

$(document).ready ->
    # Animate screens
    $("h2").click ->
        animateSection $(this).text()

    # [Go Back]
    $ "<a>"
        .addClass "back"
        .attr "href", '#'
        .html "[&larr; Go Back]"
        .appendTo ".content"
        .click ->
            toHome()

    # Resume toggle courses
    toggleCourses = $ "<a>"
                        .addClass "toggle-courses"
                        .data "action", "show"
                        .text "(Show all)"
                        .css 
                            marginLeft: "10px"
                            fontWeight: "normal"
                            fontSize: "16px"
                        .click ->
                            toggle_courses()
    $('#past-courses').append toggleCourses
    $("[data-highlight='']").hide()

(($) ->
    $.fn.shrink = ->
        @css
            width: 0
            height: 0
            opacity: 0

    $.fn.expand = ->
        @css
            width: "100%"
            height: "100%"
            opacity: 0
) jQuery;

toHome = ->
    $(".header").css
        opacity: 1
    $(".section").removeClass "hide"
    $(".content").hide()
    $(".section").css
        width: "50%"
        height: "50%"
        opacity: 1

animateSection = (name) ->
    $(".header").css
        opacity: 0
    $(".section").addClass "hide"
    currScreen = $(".section.#{name}").expand()
    otherScreens = $(".section").not(currScreen).shrink()
    $(".content.#{name}").fadeIn()

toggle_courses = ->
    action = $(".toggle-courses").data "action"
    if action is "show"
        $("[data-highlight='']").show()
        $(".toggle-courses")
            .data "action", "hide"
            .text "(Hide)"
    else
        $("[data-highlight='']").hide()
        $(".toggle-courses")
            .data "action", "show"
            .text "(Show all)"