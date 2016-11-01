var setUpCourses = function() {
    $(".show-courses").click(function() {
        showCourses();
        return false;
    });
    $(".hide-courses").click(function() {
        hideCourses();
        return false;
    });

    // hide when clicking outside container
    $(".courses").click(function() {
        hideCourses();
    });
    $(".container").click(function() {
        return false;
    });
};

var showCourses = function() {
    $("body").addClass("no-scroll");
    $(".courses")
        .addClass("active")
        .fadeIn();
};

var hideCourses = function() {
    $("body").removeClass("no-scroll");
    $(".courses")
        .fadeOut({
            complete: function() {
                $(this).removeClass("active");
            }
        });
};

window.onReady = setUpCourses;
