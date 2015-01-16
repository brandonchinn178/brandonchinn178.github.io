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
<ul>
    {% for class in currsemester.classes %}
<li>{{ class.name }} [{{ class.id }}]{% if class.note %} >> {{ class.note }}{% endif %}</li>
    {% endfor %}
</ul>

### Past Courses:
{% for semester in site.data.classes.schedule reversed %}
    {% if forloop.first %}
        {% continue %}
    {% endif %}
{{ semester.title }}
<ul>
    {% for class in semester.classes %}
<li data-highlight="{{ class.highlight }}">{{ class.name }} [{{ class.id }}]{% if class.note %} >> {{ class.note }}{% endif %}</li>
    {% endfor %}
</ul>
{% endfor %}

## Experience:

### [LeapYear Innovations](http://leapyearinnovations.com) &mdash; Independent Contractor (2014 - present)
* Developed algorithm software for Coca-Cola and database privatization
* Researched Epsilon-Differential Privacy in order to implement an algorithm privatizing a dataset of records
* Working with Python, the Tkinter GUI toolkit, and SQL databases

### Cal Band Computer Committee (2014 - present)
* The technology division of the University of California Marching Band that develops and maintains the band's public websites, and the applications used for creating and viewing the weekly halftime show. (More details in the projects page)
* Currently renovating the members website used for internal communications within the band, using the Django framework.

### [Digital Media Academy](http://digitalmediaacademy.org) &mdash; Teaching Assistant (Summer 2014)
* Assisted in teaching the Intro and Advanced Programming courses, both in Java
* Helped to teach students with Processing and Eclipse, using the acm.gui package, the Bukkit package, and the Android SDK.

### Private Tutor (2013 - 2014)
* Tutored students of middle school and high school age, constructing and implementing a different curriculum for each student's needs
* Taught Pre-Algebra, Algebra, and Pre-Calculus