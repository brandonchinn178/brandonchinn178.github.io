window.IS_HOME = window.location.pathname === "/";
window.ANIMATION_LOCK = false;

/**
 * Runs any scripts saved to the `onReady` variable, as well as setting
 * up the menu links.
 */
var onloadScripts = function() {
    if (window.onReady !== undefined) {
        window.onReady();
    }

    $(".menu-button, header a")
        // remove any previously set click handlers
        .off("click.brandonchinn178")
        .on("click.brandonchinn178", function(e) {
            // check "open in new window/tab" key modifiers
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                return;
            }

            var nextHost = $(this)[0].hostname;
            if (nextHost === window.location.hostname) {
                var nextPath = $(this).attr("href");
                startTransition(nextPath, true);
                return false;
            }
        });
};

var getFadeSelector = function(nextPath) {
    return (window.IS_HOME || nextPath === "/") ? "body" : ".content";
}

var startTransition = function(nextPath, pushHistory) {
    if (window.ANIMATION_LOCK) {
        return;
    }
    window.ANIMATION_LOCK = true;

    // update nav bar
    if (!window.IS_HOME) {
        $("header")
            .find(".active")
            .removeClass("active");

        $("header")
            .find(".page-link")
            .filter(function() {
                return $(this).attr("href") === nextPath;
            })
            .addClass("active");
    }

    // push history
    if (pushHistory) {
        var title = $("title").text();
        var state = nextPath;
        history.pushState(state, title, nextPath);
    }

    // fade out page and load next page
    var selector = getFadeSelector(nextPath);
    $(selector).animate({
        opacity: 0
    }).promise().done(function() {
        $(this).css("display", "none");

        // setup loading animation
        $("<img>")
            .attr("src", "/resources/img/loading.gif")
            .addClass("loading")
            .appendTo("html")
            .fadeIn();

        loadPage(nextPath);
    });
};

var stopTransition = function(nextPath) {
    $(".loading").remove();
    var selector = getFadeSelector(nextPath);
    $(selector)
        .css("display", "")
        .animate({
            opacity: 1
        });
    window.IS_HOME = nextPath === "/";
    window.ANIMATION_LOCK = false;
};

var loadPage = function(nextPath) {
    $.get(nextPath)
        .done(function(data) {
            // load the next page
            var nextPage = $("<div>").html(data);
            var header = nextPage.children("header");
            var content = nextPage.children("div.content");
            var headElements = nextPage.children().not(header).not(content);

            // update head resources
            var currResources = $("head").children().filter("link, script");
            var nextResources = headElements.filter("link, script");

            currResources.each(function() {
                if ($(this).attr("meta-type") === "per-page") {
                    $(this).remove();
                }
            });
            if (nextPath === "/") {
                currResources.each(function() {
                    if ($(this).attr("meta-type") === "page-wide") {
                        $(this).remove();
                    }
                });
                nextResources.each(function() {
                    if ($(this).attr("meta-type") === "home-page") {
                        $(this).appendTo("head");
                    }
                });
                $("header").remove();
            } else if (window.IS_HOME) {
                currResources.each(function() {
                    if ($(this).attr("meta-type") === "home-page") {
                        $(this).remove();
                    }
                });
                nextResources.each(function() {
                    if ($(this).attr("meta-type") === "page-wide") {
                        $(this).appendTo("head");
                    }
                })
                $("<header>")
                    .html(header.html())
                    .insertBefore(".content");
            } else {
                // page to page
                currResources.each(function() {
                    if ($(this).attr("meta-type") === "per-page") {
                        $(this).remove();
                    }
                });
            }
            nextResources.each(function() {
                if ($(this).attr("meta-type") === "per-page") {
                    $(this).appendTo("head");
                }
            });

            var title = headElements.filter("title").text();
            $("head title").text(title);

            // update content
            $(".content").html(content.html());
            onloadScripts();

            // conclude animation
            stopTransition(nextPath);
        });
};

$(document).ready(onloadScripts);

/**
 * Navigating browser history should attempt to transition pages
 */
window.onpopstate = function(event) {
    if (event.state === null) {
        startTransition(window.location.pathname, false);
    } else {
        startTransition(event.state, false);
    }
};
