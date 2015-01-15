Projects
========

{% for project in site.data.projects %}

[![](/resources/img/{{ project.img }})]({{ project.link }}) [{{ project.name }}]({{ project.link }})

{% endfor %}