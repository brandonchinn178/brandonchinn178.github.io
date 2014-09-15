function addProjectTable() {
    var projects = window._projects;
    
    for (var i = 0; i < projects.length; i++) {
        var tr = document.createElement("tr");
        var td_name = document.createElement("td");
        var td_img = document.createElement("td");
        var a = document.createElement("a");
        var img = document.createElement("img");

        var name = projects[i].getElementsByTagName("name")[0].childNodes[0].nodeValue;
        name = document.createTextNode(name);
        var link = projects[i].getElementsByTagName("link")[0].childNodes[0].nodeValue;
        var img_name = projects[i].getElementsByTagName("img")[0].childNodes[0].nodeValue;

        a.href = link;
        a.target = "_blank";
        a.appendChild(name);
        img.src = "/resources/" + img_name;

        td_name.appendChild(a);
        td_img.appendChild(img);
        tr.appendChild(td_name);
        tr.appendChild(td_img);
        document.getElementById("projects").appendChild(tr);
    }
}