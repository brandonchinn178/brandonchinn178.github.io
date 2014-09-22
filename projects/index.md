---
layout: default
title: Projects
---

Projects {#project-header}
========
Here is a list I compiled of some projects I have worked on. Each project includes a link to its source and a screenshot of the project.

<table id="projects">
    {% for project in site.data.projects %}
        <tr>
            <td><a href="{{ project.link }}" target="_blank">{{ project.name }}</a></td>
            <td><a href="{{ project.link }}" target="_blank"><img src="/resources/{{ project.img }}"></a></td>
        </tr>
    {% endfor %}
</table>