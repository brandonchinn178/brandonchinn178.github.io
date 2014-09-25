---
layout: default
title: Resume
---

R&eacute;sum&eacute;
====================
My r&eacute;sum&eacute; is available for download [here](resources/resume.pdf) as a PDF, or reformatted below for a more website-friendly and slightly more comprehensive version.

## Technical Skills ##

### Languages ###
Java, Python, HTML, CSS, Javascript

### Tools ###
JQuery, Django, MySQL

## Education ##

### University of California, Berkeley, 2013 &ndash; present ###
Intended Computer Science Major, GPA: 3.72

<table>
    <tr>
        <td><b>Current Courses:</b></td>
        <td><b>Past Courses:</b></td>
    </tr>
    <tr id="courses">
        <td rowspan="2">
            {% assign currsemester = site.data.classes.last %}
            {{ currsemester.title }}
            <ul>
                {% for class in currsemester.classes %}
                    <li>{{ class.name }} [{{ class.id }}]
                        {% if class.note %} >> {{ class.note }} {% endif %}
                    </li>
                {% endfor %}
            </ul>
        </td>
        <td>
            {% for semester in site.data.classes %}
                {% if forloop.last %}
                    {% break %}
                {% endif %}
                {{ semester.title }}
                <ul>
                    {% for class in semester.classes %}
                        {% if class.highlight %}
                            <li>
                        {% else %}
                            <li class="hidable" style="display:none;">
                        {% endif %}
                        {{ class.name }} [{{ class.id }}]
                        {% if class.note %} >> {{ class.note }} {% endif %}</li>
                    {% endfor %}
                </ul>
            {% endfor %}
        </td>
    </tr>
    <tr>
        <td><b>
            <a href="#" onclick="$('.hidable').show(); return false;">show all</a> &middot; 
            <a href="#" onclick="$('.hidable').hide(); return false;">hide</a>
        </b></td>
    </tr>
</table>

### Northwood High School, 2009 &ndash; 2013 ###
GPA: 4.18

## Work Experience ##

### <a href="http://leapyearinnovations.com" target="_blank">LeapYear Innovations</a> &mdash; _Independent Contractor_, 2014 &ndash; present ###
* Developed software that implemented algorithms for various purposes
* Involved working in a 2-3 person team
* Researched project topics in-depth to gain further insight on the algorithms being implemented

### <a href="http://digitalmediaacademy.org" target="_blank">Digital Media Academy</a> &mdash; _Teaching Assistant_, Summer 2014 ###
* Assisted in teaching an Intro to Programming with Java course, along with the Advanced Java Programming course
* Interacted with students one-on-one in-class to build understanding and foster relationships
* Led and engaged students in break-time activities

### Private Tutor, since 2013 ###
* Tutored students from middle school to high school in math subjects, ranging from pre-Algebra to pre-Calculus
* Developed unique plan of education for each student, tailoring each session to the student's ability.
* Gained considerable practice with verbal communication, time management skills, and patience

## Other Experience ##

### <a href="http://worshipdatabase.info" target="_blank">Worship Song Database</a> &mdash; _Site Developer_, 2012 &ndash; present ###
* Personal project that catalogued, tagged, and compiled song sheets into one centralized location
* Involved self-study of HTML, CSS, Django, JQuery, and SQL databases

### Cal Band Computer Committee, 2014 &ndash; present ###
* A committee in the University of California Marching Band that handles the tech side of managing the student-run band
* Worked extensively on a [website](http://calband.github.io/calchart-viewer) that assists the band in learning the weekly halftime shows

## Personality ##

### Leadership ###
* Worship leader at churches, both in Berkeley and at home, since 2007. Involves preparing song sets, organizing practices, and maintaining musicianship
* Often take initiative on jobs and projects, which are always completed in a timely manner

### Team Player ###
* One of many teaching assistants at the Digital Media Academy, which involved coordinating jobs among the others throughout the week.
* Involved with the University of California Marching Band, since 2013
    - Member of the Cal Band Computer Committee, mentioned above (see [Projects page](/projects))
* Member of other musical groups throughout high school, both instrumental and vocal, in addition to being a member of worship teams at church
* Always available to do my part to help out in any way possible