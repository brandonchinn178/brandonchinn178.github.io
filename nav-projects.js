$(document).ready(addProjects());

function addProjects() {
    if (window.XMLHttpRequest) {  // code for IE7+, Firefox, Chrome, Opera, Safari
      xmlhttp = new XMLHttpRequest();
    } else {  // code for IE6, IE5
      xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","resources/projects.xml", false);
    xmlhttp.send();
    xmlDoc = xmlhttp.responseXML;
    
    var projects = xmlDoc.getElementsByTagName("project");
    
    for (i = 0; i < projects.length; i++) {
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
}