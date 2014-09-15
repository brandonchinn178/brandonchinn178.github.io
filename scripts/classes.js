$(document).ready(function() {
    $.get("/resources/classes.xml", addCourses);
});

function addCourses(xmlDoc) {
    var semesters = xmlDoc.getElementsByTagName("semester");
    var tdPast = document.createElement("td");
    var tdCurrent = document.createElement("td");

    for (var i = 0; i < semesters.length; i++) {
        var column = (i == semesters.length - 1) ? tdCurrent : tdPast;
        var title = semesters[i].getElementsByTagName("title")[0].childNodes[0].nodeValue;
        title = document.createTextNode(title);

        var classesNode = document.createElement("ul");
        var classes = semesters[i].getElementsByTagName("class");

        for (var j = 0; j < classes.length; j++) {
            var li = document.createElement("li");
            if (column !== tdCurrent && classes[j].getAttribute("category") !== "highlight") {
                li.className = "hidable";
                li.style.display = "none";
            }

            var name = classes[j].getElementsByTagName("name")[0].childNodes[0].nodeValue;
            var id = classes[j].getElementsByTagName("id")[0].childNodes[0].nodeValue;
            var note = classes[j].getElementsByTagName("note")[0].childNodes[0];

            var liText = document.createTextNode(name + " [" + id + "]");
            if (note) {
                liText.appendData(" >> " + note.nodeValue);
            }
            li.appendChild(liText);
            classesNode.appendChild(li);
        }

        column.appendChild(title);
        column.appendChild(classesNode);
    }

    tdCurrent.rowSpan = 2;
    $("#courses")[0].appendChild(tdCurrent);
    $("#courses")[0].appendChild(tdPast);
}

// true -> show; false -> hide
function filter(show) {
    if (show) {
        $(".hidable").show();
    } else {
        $(".hidable").hide();
    }

    return false;
}