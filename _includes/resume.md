Resume
======

My resume is available for download [here](https://www.dropbox.com/s/dvzh9e02nwbski1/Resume.pdf?dl=0) or below, for viewing.

## Technical Skills

### Languages
Java, Python, HTML5, CSS3, Javascript

### Tools and Packages
Git/Github, jQuery, Django, SQL

## Education

### University of California, Berkeley (2013 - present)
Computer Science, GPA: {{ site.data.classes.gpa }}

### Northwood High School (2009 - 2013)
GPA: 4.18

### Current Courses:
{% assign currsemester = site.data.classes.schedule.last %}
{{ currsemester.title }}
    {% for class in currsemester.classes %}
<li>{{ class.name }} [{{ class.id }}]{% if class.note %} >> {{ class.note }}{% endif %}</li>
    {% endfor %}

### Past Courses:
{% for semester in site.data.classes.schedule reversed %}
    {% if forloop.first %}
        {% continue %}
    {% endif %}
{{ semester.title }}
    {% for class in semester.classes %}
<li data-highlight="{{ class.highlight }}">{{ class.name }} [{{ class.id }}]{% if class.note %} >> {{ class.note }}{% endif %}</li>
    {% endfor %}
{% endfor %}