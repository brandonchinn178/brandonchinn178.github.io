$(document).ready(addProjects);

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
        var tr = document.createElement("tr");
        var td_name = document.createElement("td");
        var td_img = document.createElement("td");
        var a = document.createElement("a");
        var img = document.createElement("img");

        var name = projects[i].getElementsByTagName("name")[0].childNodes[0].nodeValue;
        var text = document.createTextNode(name);
        var link = projects[i].getElementsByTagName("link")[0].childNodes[0].nodeValue;
        var img_name = projects[i].getElementsByTagName("img")[0].childNodes[0].nodeValue;

        a.href = link;
        a.target = "_blank";
        a.appendChild(text);
        img.src = "resources/" + img_name;
        td_name.appendChild(a);
        td_img.appendChild(img);
        tr.appendChild(td_name);
        tr.appendChild(td_img);
        document.getElementById("projects").appendChild(tr);
    }
}