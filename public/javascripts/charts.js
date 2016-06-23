//Colors
var color = ["#F47D23", "#3498DB", "#2ECC71", "#CC3333", "#1F77B4", "#2CA02C"];
var colorTemps = ["#2CA02C","#D62728", "#3182BD", "#98DF8A","#FF9896", "#6BAED6"];

$(document).ready(function () {
    dirGraphs = document.getElementById('dir').textContent;
    barChart("Duty Cycle");
    barChart("Load kW");
    barChart("Load kWh");
    lineChart();
    pieChart();
    table("Participating");
    table("Non Participating");
    table("Opt Out");
    table("No Data");
})

function barChart(datatype) {
    var fileName, divID , yAxisText, yAxisScaleAdjust = 1, tickformat = "", decimalPlaces = 2, marginTop = 30;

    if (datatype == "Duty Cycle") { 
        fileName = dirGraphs + '/Graphs/' + "ChartDutyCycles.csv"; 
        divID = "#DutyCycle"; 
        yAxisText = "Average Duty Cycle [%]"; 
        tickformat = "%";
        yAxisScaleAdjust = 10;
        decimalPlaces = 1;
        marginTop = 10;
    } else if (datatype == "Load kW") { 
        fileName = dirGraphs + '/Graphs/' + "ChartLoadkW.csv"; 
        divID = "#LoadkW"; 
        yAxisText = "Average Load [kW]"; 
        yAxisScaleAdjust = 1;
    } else if (datatype == "Load kWh") { 
        fileName = dirGraphs + '/Graphs/' + "ChartLoadkWh.csv"; 
        divID = "#LoadkWh"; 
        yAxisText = "Average Load [kWh]";
        yAxisScaleAdjust = 0.2;
    }


    var margin = {
            top: marginTop,
            right: 0,
            bottom: 110,
            left: 20
        },
        width = 850,
        height = 350;

    var x0 = d3.scale.ordinal()
        .rangeBands([0, width], 0.25, 0.1);

    var x1 = d3.scale.ordinal();

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x0)
        .orient("bottom")
        .tickFormat(function (d) {
            return d.substring(0, d.lastIndexOf(":00"));
        })
        .innerTickSize(-height)
        .outerTickSize(0)
        .tickPadding(10);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickFormat(function (d) { 
            return d + tickformat;
        })
        .innerTickSize(-width)
        .outerTickSize(0)
        .tickPadding(10);    


    var svg = d3.select(divID).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.csv(fileName, function (error, data) {
        if (error) throw error;

        var columns = d3.keys(data[0]).filter(function (key) {
            return ((key !== "Time") && (key !== "Date"))
        });
        
        
        //For Total Fields
        var kWSum = 0, kWMax = 0, kWAverage = 0, kWhSum = 0, kWhMax = 0, differences = [];
        
        if (datatype == "Load kW") { 
            data.forEach(function(d) {
               differences.push(+(Number(d["Difference"]))); 
            });
            
            for(var val in differences) { 
                kWMax = differences[val] > kWMax ? differences[val] : kWMax;
                kWSum += differences[val];
            } 
            
            kWAverage = (kWSum/differences.length).toFixed(2);            
            
            var details = d3.select(divID).insert("div", ":nth-child(2)")
                .attr("class", "chartDetails clearfix");
            
            details.append("p")
                .attr("class", "chartNote left")
                .html("Max kW Saved during DR: <span class=\"emphasis\">" + kWMax + " kW</span>")
            details.append("p")
                .attr("class", "chartNote right")
                .html("Average kW over DR: <span class=\"emphasis\">" + kWAverage + " kW</span>");
            
        } else if (datatype == "Load kWh") { 
            data.forEach(function(d) {
               differences.push(+(Number(d["Difference"]))); 
            });
            
            for(var val in differences) { 
                kWhMax = differences[val] > kWhMax ? differences[val] : kWhMax;
                kWhSum += differences[val]; 
            }
            
            d3.select(divID)
                .insert("p", ":nth-child(2)")
                .attr("class", "chartNote")
                .html("Total kWh Saved during DR: <span class=\"emphasis\"> " + kWhSum + " kWh</span>");
            
        }
        
        data.forEach(function (d) {
            d.columnValues = columns.map(function (value) {
                return {
                    name: value,
                    value: +(Number(d[value]))
                };
            });
        });

        x0.domain(data.map(function (d) {
            return d.Time;
        }));

        x1.domain(columns).rangeRoundBands([0, x0.rangeBand()]);
        y.domain([d3.min(data, function (d) {
                return d3.min(d.columnValues, function (d) {
                    if (datatype = "Duty Cycle") { return Math.max(-100, (Math.floor(d.value / yAxisScaleAdjust) * yAxisScaleAdjust)); }
                    else { return (Math.floor(d.value)); }

                });
            }),
                  d3.max(data, function (d) {
                return d3.max(d.columnValues, function (d) {
                    if (datatype = "Duty Cycle") { return Math.min(100, (Math.ceil(d.value / yAxisScaleAdjust) * yAxisScaleAdjust)); }
                    else { return (Math.floor(d.value)); }
                });
            })]);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(" + (x1.rangeBand() * 2) + "," + y(y.domain()[0]) + ")")
            .call(xAxis)
            .append("text")
            .attr("y", 50)
            .attr('x', (width - margin.left) / 2)
            .style("text-anchor", "end")
            .text("Time")
            .attr("font-weight", "bold");

        svg.selectAll(".x .tick text")
            .attr("transform", "translate(" + -(x1.rangeBand() * 2) + ",0)")
            .style("text-anchor", "middle")

        svg.selectAll(".x .tick line")
            .style("stroke", "#EAEAEA");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr('x', -height / 2)
            .style("text-anchor", "middle")
            .text(yAxisText)
            .attr("font-weight", "bold");

        var tip = d3.tip()
            .attr('class', 'd3-tip')
            .offset([-10, 0])
            .html(function (d, i) {
                return "<span style=\"color:" + color[i] + ";\">" + (d.value).toFixed(decimalPlaces) + "</span>";
            })

        svg.call(tip);

        var time = svg.selectAll(".Time")
            .data(data)
            .enter().append("g")
            .attr("class", "time")
            .attr("transform", function (d) {
                return "translate(" + x0(d.Time) + ",0)";
            });


        time.selectAll("rect")
            .data(function (d) {
                return d.columnValues;
            })
            .enter().append("rect")
            .attr("width", x1.rangeBand())
            .attr("x", function (d) {
                return x1(d.name);
            })
            .attr("y", function (d) {
                return Math.min(y(0), y((d.value)));
            })
            .attr("height", function (d) {
                return Math.abs(y(0) - y((d.value)));
            })
            .style("fill", function (d, i) {
                return color[i];
            })
            .on('mouseover', function (d, i) { tip.show(d, i); })
            .on('mouseout', tip.hide);

        //LEGEND
        var legend = svg.selectAll(".legend")
            .data(columns.slice())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
                return "translate(" + i * 300 + "," + 420 + ")";
            });

        legend.append("rect")
            .attr("x", 3 * margin.left)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", function (d, i) {
                return color[i];
            });

        legend.append("text")
            .attr("x", 3 * margin.left + 30)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .text(function (d) {
                return d;
            })
            .attr("font-weight", "bold");
    });
}

function pieChart() {
    //Defining size of Pie Chart
    var width = 400,
        height = 450,
        radius = 200,
        marginBottom = 20,
        innerRadius = 100;

    //File where data is stored
    var fileName = dirGraphs + '/Graphs/' + "ChartParticipation.csv"; //This needs to be dynamic

    //Obtain the Data
    d3.csv(fileName, function (error, data) {
        if (error) {
            throw error;
        }
        var total = 0;

        //Define a Pie
        var pie = d3.layout.pie()
            .value(function (d) {
                if (d.Group == "Total") {
                    total = +d.Count;
                    return 0;
                } else {
                    return +d["Count"];
                }
            });

        //Create a sencil by parsing the data to pie constructor
        var stencil = pie(data);

        //Create SVG Element
        var svg = d3.select("#Participation")
            .append('svg')
            .attr("x", 0)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr("transform", "translate(" + 0 + "," + (height - marginBottom)/ 2 + ")");

        var textTop = svg.append("text")
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .attr("class", "textTop")
            .text("TOTAL THERMOSTATS")
            .attr("y", -20),
            textBottom = svg.append("text")
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .attr("class", "textBottom")
            .text(total)
            .attr("y", 20);


        //Add container in SVG
        var container = svg.append('g')
            .attr('transform', "translate(0,0)");


        //Define shape of pieces
        var arc = d3.svg.arc()
            .outerRadius(radius)
            .innerRadius(innerRadius);

        var arcOver = d3.svg.arc()
            .outerRadius(radius + 10)
            .innerRadius(innerRadius + 10);


        var g = container.selectAll("g")
            .data(stencil)
            .enter()
            .append("g")
            .attr("class", "slice")
            .on("mouseover", function (d) {
                d3.select(this).select("path").transition()
                    .duration(200)
                    .attr("d", arcOver);
                textTop.text((d3.select(this).datum().data.Group).toUpperCase())
                    .attr("y", -20);
                textBottom.text((d3.select(this).datum().data.Count) + " (" + ((d3.select(this).datum().data.Count)/total * 100).toFixed(0) + "%)")
                    .attr("y", 20)
            })
            .on("mouseout", function (d) {
                d3.select(this).select("path").transition()
                    .duration(100)
                    .attr("d", arc);
                textTop.text("TOTAL THERMOSTATS")
                    .attr("y", -20);
                textBottom.text(total)
                    .attr("y", 20)
            });

        //Append a path element to each g tag and make it a colorful arc
        g.append("path")
            .attr("d", arc)
            .style("fill", function (d, i) {
                return color[i];
            });


        //Legend
        var legend = container.append("svg")
            .attr("class", "legend")
            .attr("x", radius)
            .attr("y", -80)
            .attr("width", 200)
            .attr("height", height)
            .selectAll("g")
            .data(data)
            .enter().append("g")
            .attr("transform", function (d, i) {
                return "translate(50," + i * 40 + ")";
            });

        legend.append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", function (d, i) {
                if (d.Group == "Total") {
                    return "transparent";
                } else {
                    return color[i];
                }
            });

        legend.append("text")
            .attr("x", 30)
            .attr("y", 9)
            .attr("dy", ".35em")
            .attr("font-weight", "bold")
            .text(function (d) {
                if (d.Group == "Total") {
                    return "";
                } else {
                    if (d.Group == "No Data") {
                        return ("Thermostats without sufficient data (" + d.Count + ")");
                    } else { return (d.Group + " Thermostats (" + d.Count + ")"); }
                }
            });
    });
}

function lineChart(thermostatGroup) {
     var margin = {
            top: 10,
            right: 0,
            bottom: 160,
            left: 20
        },
        width = 850,
        height = 350;

    var x = d3.time.scale()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickFormat(d3.time.format("%H:%M"))
        .innerTickSize(-height)
        .outerTickSize(-height)
        .tickPadding(10);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .innerTickSize(-width)
        .outerTickSize(-width)
        .tickPadding(10);

    var line = d3.svg.line()
        .interpolate("basis")
        .x(function (d) {
            return x(d.date);
        })
        .y(function (d) {
            return y(d.temperature);
        });

    var fileName = dirGraphs + '/Graphs/' + "ChartTemperatures.csv", divID = "#Temperatures";

    var svg = d3.select(divID).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.csv(fileName, function (error, data) {
        if (error) throw error;
        var bisectDate = d3.bisector(function (d) {
            return d.date;
        }).right;

        var temperatures = d3.keys(data[0]).filter(function (key) {
            return ((key !== "Time") && (key !== "Date"))
            
            //To Exclude Heating
            //return ((key !== "Time") && (key !== "Date") && (key !== "Participating Heat Temperature") && (key !== "Non Participating Heat Temperature"))
        });


        data.forEach(function (d) {
            d.Date = new Date(d.Date + " " + d.Time);
        });

        var hourlyTemp = temperatures.map(function (name) {
            return {
                name: name,
                values: data.map(function (d) {
                    return {
                        date: d.Date,
                        temperature: +d[name]
                    };
                })
            };
        });

        x.domain(d3.extent(data, function (d) {
            return d.Date;
        }));

        y.domain([d3.min(hourlyTemp, function (d) {
                return d3.min(d.values, function (d) {
                    return (Math.floor(d.temperature / 10) * 10);
                });
            }),
                  d3.max(hourlyTemp, function (d) {
                return d3.max(d.values, function (d) {
                    return (Math.ceil(d.temperature / 10) * 10);
                });
            })]);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + y(y.domain()[0]) + ")")
            .call(xAxis)
            .append("text")
            .attr("y", 50)
            .attr('x', (width - margin.left) / 2)
            .style("text-anchor", "middle")
            .text("Time")
            .attr("font-weight", "bold");

        svg.selectAll(".x .tick text")
            .attr("transform", "translate(0,0)")
            .style("text-anchor", "middle")

        svg.selectAll(".x .tick line")
            .style("stroke", "#EAEAEA");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr('x', -height / 2)
            .style("text-anchor", "middle")
            .text("Temperature (ºF)")
            .attr("font-weight", "bold");



        var zone = svg.selectAll(".zone")
            .data(hourlyTemp)
            .enter().append("g")
            .attr("class", "zone");

        zone.append("path")
            .attr("class", "line")
            .attr("d", function (d) {
                return line(d.values);
            })
            .style("stroke", function (d, i) {
                return colorTemps[i];
            })
            .style("stroke-width", '2.5px');
        
        var tip = d3.tip()
            .attr('class', 'd3-tip')
            .offset([150, 375])
            .html(function (i) {
//                return "<span style=\"color:#2CA02C;\">" + hourlyTemp[0].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#D62728;\">" + hourlyTemp[1].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#3182BD;\">" + hourlyTemp[2].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#98DF8A;\">" + hourlyTemp[3].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#FF9896;\">" + hourlyTemp[4].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#6BAED6;\">" + hourlyTemp[5].values[i].temperature.toFixed(1) + " ºF</span>";                
                
                return "<span style=\"color:#3182BD;\">" + hourlyTemp[2].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#6BAED6;\">" + hourlyTemp[5].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#2CA02C;\">" + hourlyTemp[0].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#98DF8A;\">" + hourlyTemp[3].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#D62728;\">" + hourlyTemp[1].values[i].temperature.toFixed(1) + " ºF</span><br/><span style=\"color:#FF9896;\">" + hourlyTemp[4].values[i].temperature.toFixed(1) + " ºF</span>";
        })

        svg.call(tip);

        //LEGEND
        var legend = svg.selectAll(".legend")
            .data(temperatures.slice())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
//                if (i < 3) { return "translate(" + (i * 300) + "," + 420 + ")"; }
//                else { return "translate(" + ((i % 3) * 300) + "," + 460 + ")"; }                
                
                if (i < 3) { 
                    if (i == 0) { return "translate(" + (1 * 300) + "," + 420 + ")"; }
                    else if (i == 1) { return "translate(" + (2 * 300) + "," + 420 + ")"; } 
                    else if (i == 2) { return "translate(" + (0 * 300) + "," + 420 + ")"; }
                 }
                else { 
                    if (i % 3 == 0) { return "translate(" + (1 * 300) + "," + 460 + ")"; }
                    else if (i % 3 == 1) { return "translate(" + (2 * 300) + "," + 460 + ")"; } 
                    else if (i % 3 == 2) { return "translate(" + (0 * 300) + "," + 460 + ")"; }
                }
            });

        legend.append("rect")
            .attr("x", 0)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", function (d, i) {
                return colorTemps[i];
            });

        legend.append("text")
            .attr("x", 30)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .text(function (d) {
                return d.replace("Temperature", "Temp");
            })
            .attr("font-weight", "bold");

        //ToolTip
        var focus = svg.append("g")
            .attr("class", "focus")
            .style("display", "none");

        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function () {
                focus.style("display", null);
            })
            .on("mouseout", function () {
                focus.style("display", "none");
            })
            .on("mousemove", mousemove)
            .on("mouseout", tip.hide);

        function mousemove() {
            var x0 = x.invert(d3.mouse(this)[0]),
                i = bisectDate(hourlyTemp[0].values, x0, 1),
                d0 = hourlyTemp[0].values[i - 1],
                d1 = hourlyTemp[0].values[i],
                d = x0 - d0.date > d1.date - x0 ? d1 : d0;    
                tip.show(i);
        }
    });
}

function table(datatype) {
    var fileName, divID;

    if (datatype == "Participating") { 
        fileName = dirGraphs + "/Participating.csv"; 
        divID = "#participating"; 
    } else if (datatype == "Non Participating") { 
        fileName = dirGraphs + "/NonParticipating.csv"; 
        divID = "#nonParticipating"; 
    } else if (datatype == "Opt Out") { 
        fileName = dirGraphs + "/OptOut.csv"; 
        divID = "#optOut";     
    } else if (datatype == "No Data") { 
        fileName = dirGraphs + "/NoData.csv"; 
        divID = "#noData";     
    }
    

    $.get(fileName, function (csv, err) {
        csv = csv.split('\n').sort();
        for(var id in csv) {
            $(divID).append('<p>' + csv[id] + '</p>')
        }
    });
}