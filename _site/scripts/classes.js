$(document).ready(filter);

function addCourses(filter) {
    var row = document.getElementById("courses");

    if (window.XMLHttpRequest) {  // code for IE7+, Firefox, Chrome, Opera, Safari
      xmlhttp = new XMLHttpRequest();
    } else {  // code for IE6, IE5
      xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","/resources/classes.xml", false);
    xmlhttp.send();
    xmlDoc = xmlhttp.responseXML;
    
    var semesters = xmlDoc.getElementsByTagName("semester");

    var tdPast = document.createElement("td");
    var tdCurrent = document.createElement("td");

    for (var i = 0; i < semesters.length; i++) {
        var current = i == semesters.length - 1;

        var title = document.createTextNode(semesters[i].getElementsByTagName("title")[0].childNodes[0].nodeValue);
        if (current) {
            tdCurrent.appendChild(title);
        } else {
            tdPast.appendChild(title);
        }

        var classesNode = document.createElement("ul");
        var classes = semesters[i].getElementsByTagName("class");

        for (var j = 0; j < classes.length; j++) {
            if (current || !filter || classes[j].getAttribute("category") === "highlight") {
                var li = document.createElement("li");
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
        }
        if (current) {
            tdCurrent.appendChild(classesNode);
        } else {
            tdPast.appendChild(classesNode);
        }
    }

    tdCurrent.rowSpan = 2;
    row.appendChild(tdCurrent);
    row.appendChild(tdPast);
}

function clearNodes() {
    var tr = document.getElementById("courses");
    while(tr.firstChild) {
        tr.removeChild(tr.firstChild);
    }
}

function show() {
    clearNodes();
    addCourses(false);
    return false;
}

function filter() {
    clearNodes();
    addCourses(true);
    return false;
}