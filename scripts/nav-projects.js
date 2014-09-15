$(document).ready(function() {
    $.get("/resources/projects.xml", addProjectsToNav);
});

function addProjectsToNav(xmlDoc) {
    var projects = window._projects = xmlDoc.getElementsByTagName("project");
    
    for (var i = 0; i < projects.length; i++) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        var name = projects[i].getElementsByTagName("name")[0].childNodes[0].nodeValue;
        var text = document.createTextNode(name);
        var link = projects[i].getElementsByTagName("link")[0].childNodes[0].nodeValue;
        a.href = link;
        a.target = "_blank";
        a.appendChild(text);
        li.appendChild(a);
        document.getElementById("nav-projects").appendChild(li);
    }

    if (typeof addProjectTable !== "undefined") {
        addProjectTable();
    }
}