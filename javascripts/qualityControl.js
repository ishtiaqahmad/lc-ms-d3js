//var url = "https://dl.dropboxusercontent.com/s/afaxphho9v2rrhf/Dashboard.json";
var url = 'data/metabolomics.json';
var shapes = ['circle', 'cross', 'triangle-up', 'triangle-down', 'diamond', 'square'], random = d3.random.normal();
var Dashboard, elm;
var jsonObj;
var qcFitRatioChart, isAreaChart, focusChart;

var chartsSettingArr = {   // charts array and its default values
    ratioChart: {
        key: 'Ratio',
        sampleType: 'Sample',
        groupBy: 'batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Ratio (uncorrected)',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    ratioQChart: {
        key: 'RatioQ',
        sampleType: 'Sample',
        groupBy: 'batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Ratio (QC corrected)',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    areaChart: {
        key: 'Area',
        sampleType: 'Sample',
        groupBy: 'batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Area',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    rtChart: {
        key: 'RT',
        sampleType: 'Sample',
        groupBy: 'batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Retention Time',
        visible: true,
        chartObject: nv.models.scatterChart()
    }
};

function tooltipContent(key, x, y, e, graph) {
    var selectedValues = $('#compound').val();
    //console.log(eval('Dashboard.metabolites['+selectedValues+'].'+key));
    return '<h3>' + key + '</h3>' +
        '<p>Batch :' + e.point.batch + ' Sample :' + e.point.sampLab + '</p>' +
        '<p>' + y + ' on ' + x + '</p>';

}
/*
 * TODo
 * implement efficient way to find min/max
 * var max_of_array = Math.max.apply(Math, array);
 */
function getMinMax(data) {
    var minY, maxY, minX, maxX;
    data.forEach(function (d) {
        if (d.values.length) {
            minY = maxY = d.values[0].y;
            minX = maxX = d.values[0].x;
            d.values.forEach(function (s) {
                minX = Math.min(minX, s.x);
                maxX = Math.max(maxX, s.x);
                minY = Math.min(minY, s.y);
                maxY = Math.max(maxY, s.y);
            });
        }
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY}
}

function filterMetaboliteData(dashboard, metIdx, sampleType, response, groupBy) { //# groups,# points per group
    var data = [];
    var metabolite = dashboard.metabolites[metIdx];
    var sampleTypeObj = eval('metabolite.' + sampleType);
    if (!sampleTypeObj) {
        console.error("SampleType:" + sampleType + " does not exist");
        console.error("Object does not have property name:", sampleType);
        return
    }

    var responseVals = eval('sampleTypeObj.' + response);
    if (!responseVals) {
        console.error("No such response type exist:", response);
        return
    }
    /*
     * check if we need to make groups
     * some time you don't need to group for example QCSample are not grouped by batches
     */
    if (groupBy) {
        // make obj according to group
        switch (groupBy) {
            case 'batch' :
                var batchArr = sampleTypeObj.batch.map(function (x) {    //convert string values to int
                    return parseInt(x);
                });

                for (i = 0; i < d3.max(batchArr); i++) {    // fill the batch number i.e. batch 1, batch 2 etc
                    data.push({
                        key: "Batch " + (i + 1),
                        values: []
                    });
                    /* fill obj
                     *  Assume values are filled as sorted group#
                     */
                    for (j = 0; j < sampleTypeObj.OrderAll.length; j++) {
                        var b = parseInt(sampleTypeObj.batch[j]);
                        if ((b - 1 ) != i) continue;
                        var yVal = responseVals[j];
                        /*// remove NaN values
                         yVal = $.isNumeric(yVal) ? yVal : null;
                         if (!yVal) {
                         console.warn("NaN value at compound:" + sampleTypeObj.samplabs[j] + ", index:" + j, "Batch:" + b);
                         continue;
                         }*/
                        data[i].values.push({
                                x: sampleTypeObj.OrderAll[j],
                                y: yVal,
                                sampLab: sampleTypeObj.samplabs[j],
                                batch: b
                            }
                        )
                        ;
                    }
                }
                break;
        }
    }
    else { // single obj will be return
        // make response obj according
        if (responseVals && sampleTypeObj) {
            var mean = d3.mean(responseVals);
            var v = variance(responseVals);

            data.push({
                key: sampleType,
                mean: mean,
                variance: v,
                values: []
            });
            /*
             console.log("Mean->", d3.mean(responseVals));
             console.log("Median->", d3.median(responseVals));
             var v = variance(responseVals);
             var sd = Math.sqrt(v);
             console.log("Standard Deviation->", sd);
             */
            $.each(responseVals, function (idx, yVal) {
                // remove NaN values
                yVal = $.isNumeric(yVal) ? yVal : null;
                /*if (!yVal) {
                 console.warn("NaN value at compound:" + sampleTypeObj.samplabs[idx] + ", index:" + idx, "Batch:" + sampleTypeObj.batch[idx]);
                 return
                 }*/
                data[0].values.push({
                    x: sampleTypeObj.OrderAll[idx],
                    y: yVal,
                    sampLab: sampleTypeObj.samplabs[idx],
                    batch: sampleTypeObj.batch[idx]
                })
            });
        }
    }
    return data;
}
function variance(x) {
    var n = x.length;
    if (n < 1) return NaN;
    if (n === 1) return 0;
    var mean = d3.mean(x),
        i = -1,
        s = 0;
    while (++i < n) {
        var v = x[i] - mean;
        s += v * v;
    }
    return s / (n - 1);
}

function removeGraph(setting) {
    var chartId = setting.key + 'Graph';
    if ($('#' + chartId).length) {
        $('#' + chartId).remove();
    }  //else does not exist

}

function updateGraph(data, setting) {
    var chartId = setting.key + 'Graph';
    if ($('#' + chartId).length) {
        var minMax = getMinMax(data);
        var chart = setting.chartObject;
        if (chart) {
            chart.forceY([(minMax.minY - minMax.minY * .1 ), (minMax.maxY + minMax.maxY * .1 )]);
            chart.update();
            d3.select('#' + chartId + ' svg')
                .datum(data)
                .transition().duration(500)
                .call(chart);
        } else {
            console.error("UpdateError:Chart object does not exist ");
        }
    } else {
        // does not exist creat it instead
    }

}

function drawGraph(data, setting) {
    var chartId = setting.key + 'Graph';
    if ($('#' + chartId).length) {  // exist update it instead
        updateGraph(data, setting);

    } else {
        $('<div/>', {
            "class": "dashboardChart",
            title: setting.key + 'Graph',
            id: chartId
        }).appendTo('#DashboardChartArea').prepend('<svg/>');

        $('#' + chartId).prepend("<div class='row'>" +
            "<div class='span00 text-center'>" +
            "<p><span class='label label-important'>" + setting.key + " Chart</span></p>" +
            "</div></div>");

        var gp = function () {
            var minMax = getMinMax(data);
            var chart = setting.chartObject
                .showDistX(true)
                .showDistY(true)
                .useVoronoi(true)
                .color(d3.scale.category10().range());

            chart.xAxis
                .tickFormat(d3.format('d'))
                .axisLabel(setting.xAxisLabel);

            chart.yAxis
                .tickFormat(d3.format('.02f'))
                .axisLabel(setting.yAxisLabel);

            chart.forceY([(minMax.minY - minMax.minY * .1 ), (minMax.maxY + minMax.maxY * .1 )]);
            //chart.forceX([0, jsonObj.OrderAll.length]);
            chart.sizeDomain([100, 100])
                .sizeRange([100, 100]);
            chart.tooltipContent(tooltipContent);

            d3.select('#' + chartId + ' svg')
                .datum(data)
                .transition().duration(500)
                .call(chart);
            nv.utils.windowResize(chart.update);

            chart.dispatch.on('stateChange', function (e) {
                console.log('New State:', JSON.stringify(e));
            });

            chart.scatter.dispatch.on('elementMouseout', function (_) {
                setTimeout(function () {
                    if (elm && elm.seriesIndex == _.seriesIndex && elm.pointIndex == _.pointIndex) {
                        //chart.scatter.highlightPoint(_.seriesIndex, _.pointIndex, true);
                        $.each(Object.keys(chartsSettingArr), function (idx, ch) {
                            var chartSetting = eval('chartsSettingArr.' + ch);
                            if (chartSetting.visible) {
                                chartSetting.chartObject.scatter.clearHighlights();
                                chartSetting.chartObject.scatter.highlightPoint(_.seriesIndex, _.pointIndex, true);
                            }
                        });
                    }
                }, 100);

            });
            chart.scatter.dispatch.on('elementClick', function (_) {
                elm = _;
                chart.scatter.clearHighlights();
            });
            setting.chartObject = chart;
            return chart;
        }
        nv.addGraph(gp);
    }
}

$(function () {
    $("#settingform").submit(function (event) {
        event.preventDefault();
        $("#settingform input").each(function (idx, checkboxs) {
            switch (checkboxs.id) {
                case "showArea" :
                    chartsSettingArr.areaChart.visible = checkboxs.checked ? true : false;
                    break;
                case "showRT":
                    chartsSettingArr.rtChart.visible = checkboxs.checked ? true : false;
                    break;
                case "showRatioUnc" :
                    chartsSettingArr.ratioChart.visible = checkboxs.checked ? true : false;
                    break;
                case "showRatioQ" :
                    chartsSettingArr.ratioQChart.visible = checkboxs.checked ? true : false;
                    break;
                default :
                    //reset default here
                    break;
            }
        });
        $('#advancedSettings').modal('hide');
        drawVisibleCharts();
    })
});

function drawVisibleCharts(extent) {
    $.each(Object.keys(chartsSettingArr), function (idx, ch) {
        var chartSetting = eval('chartsSettingArr.' + ch);
        var selectedMetabolite = $('#compound').val();
        if (chartSetting.visible) {
            var btData = filterMetaboliteData(Dashboard, selectedMetabolite, chartSetting.sampleType, chartSetting.key, chartSetting.groupBy);
            var qcSampleData = filterMetaboliteData(Dashboard, selectedMetabolite, 'QCsample', chartSetting.key);
            qcSampleData = $.extend(qcSampleData[0], {color: 'black', slope: 1});
            btData = btData.concat(qcSampleData);
            /*
             *  pre-filter the final data before actual drawing
             *   filter orderAll only between brush extent i.e. [2, 30]
             */
            if (extent) {
                btData.map(function (d) {
                    d.values = d.values.filter(function (d) {
                        return extent[0] <= d.x && d.x <= extent[1];
                    });
                    return d;
                });
            }
            drawGraph(btData, chartSetting);
        } else {
            // remove it from dom element
            removeGraph(chartSetting);
        }

    });

}

function drawISAreaMultiChart() {
    var selectedMetabolite = $('#compound').val();
    var btData = filterMetaboliteData(Dashboard, selectedMetabolite, chartsSettingArr.areaChart.sampleType, chartsSettingArr.areaChart.key, chartsSettingArr.areaChart.groupBy);
    var qcSampleData = filterMetaboliteData(Dashboard, selectedMetabolite, 'QCsample', chartsSettingArr.areaChart.key);
    var isAreaData = filterMetaboliteData(Dashboard, selectedMetabolite, 'All', 'ISArea');
    isAreaData[0].key = "ISArea";
    $.each(btData, function (i, d) {
        d = $.extend(d, {type: 'scatter', yAxis: 1});
    });
    isAreaData = $.extend(isAreaData[0], {type: 'line', yAxis: 2});
    qcSampleData = $.extend(qcSampleData[0], {color: 'black', type: 'scatter', yAxis: 1});
    btData = btData.concat(qcSampleData);
    var data = btData.concat(isAreaData);
    if (isAreaChart !== undefined) {  // exist update it instead
        var chart = isAreaChart;
        chart.update();
        d3.select('#ISAreaMultiChart svg')
            .datum(data)
            .transition().duration(500)
            .call(chart);
    } else {
        nv.addGraph(function () {
            var chart = nv.models.modifyMultiChart()
                .margin({top: 30, right: 60, bottom: 50, left: 70})
                .color(d3.scale.category10().range());

            chart.xAxis
                .tickFormat(d3.format('d'))
                .axisLabel("Order");

            chart.yAxis1
                .tickFormat(d3.format('.02f'))
                .axisLabel("Area");

            chart.yAxis2
                .tickFormat(d3.format('.02f'))
                .axisLabel("ISArea");


            chart.scatter1.sizeDomain([100, 100])
                .sizeRange([100, 100]);

            chart.scatter2.sizeDomain([100, 100])
                .sizeRange([100, 100]);

            chart.tooltipContent(tooltipContent);


            d3.select('#ISAreaMultiChart svg')
                .datum(data)
                .transition().duration(500).call(chart);
            isAreaChart = chart;
            return chart;
        });
    }
}

function drawQcFitMultiChart() {
    var selectedMetabolite = $('#compound').val();
    var btData = filterMetaboliteData(Dashboard, selectedMetabolite, chartsSettingArr.ratioChart.sampleType, chartsSettingArr.ratioChart.key, chartsSettingArr.ratioChart.groupBy);
    var qcSampleData = filterMetaboliteData(Dashboard, selectedMetabolite, 'QCsample', chartsSettingArr.ratioChart.key);
    var qcFitData = filterMetaboliteData(Dashboard, selectedMetabolite, 'All', 'QCfit');
    qcFitData[0].key = "QCfit";
    $.each(btData, function (i, d) {
        d = $.extend(d, {type: 'scatter', yAxis: 1});
    });
    qcFitData = $.extend(qcFitData[0], {type: 'line', yAxis: 1});
    qcSampleData = $.extend(qcSampleData[0], {color: 'black', type: 'scatter', yAxis: 1});
    btData = btData.concat(qcSampleData);
    var data = btData.concat(qcFitData);

    var meanDataPoints = {key: "Mean", color: 'black', type: 'line', yAxis: 1, values: []},
        meanPlus2StdDataPoints = {key: "Mean+2Std", color: 'black', type: 'line', yAxis: 1, values: []},
        meanMinus2StdDataPoints = {key: "Mean-2Std", color: 'black', type: 'line', yAxis: 1, values: []};

    $.each(qcSampleData.values, function (i, val) {
        meanDataPoints.values.push({
            x: val.x,
            y: qcSampleData.mean,
            sampLab: val.sampLab,
            batch: val.batch

        });
        meanPlus2StdDataPoints.values.push({
            x: val.x,
            y: qcSampleData.mean + 2 * Math.sqrt(qcSampleData.variance),
            sampLab: val.sampLab,
            batch: val.batch

        });
        meanMinus2StdDataPoints.values.push({
            x: val.x,
            y: qcSampleData.mean - 2 * Math.sqrt(qcSampleData.variance),
            sampLab: val.sampLab,
            batch: val.batch

        });
    });
    var data = data.concat(meanDataPoints);
    var data = data.concat(meanPlus2StdDataPoints);
    var data = data.concat(meanMinus2StdDataPoints);

    if (qcFitRatioChart !== undefined) {  // exist update it instead
        var chart = qcFitRatioChart;
        chart.update();
        d3.select('#QCfitMultiChart svg')
            .datum(data)
            .transition().duration(500)
            .call(chart);
    } else {
        nv.addGraph(function () {
            var chart = nv.models.modifyMultiChart()
                .margin({top: 30, right: 60, bottom: 50, left: 70})
                .color(d3.scale.category10().range());

            chart.xAxis
                .tickFormat(d3.format('d'))
                .axisLabel("Order");

            chart.yAxis1
                .tickFormat(d3.format('.02f'))
                .axisLabel(chartsSettingArr.ratioChart.yAxisLabel);

            chart.lines1.scatter.shape(shapes[5]);

            chart.scatter1.sizeDomain([100, 100])
                .sizeRange([100, 100]);

            chart.scatter2.sizeDomain([100, 100])
                .sizeRange([100, 100]);

            chart.tooltipContent(tooltipContent);


            d3.select('#QCfitMultiChart svg')
                .datum(data)
                .transition().duration(500).call(chart);
            qcFitRatioChart = chart;
            return chart;
        });
    }
}


/*
 *
 * Let's create the context brush that will let us zoom and pan the chart
 *
 */

function drawContextBrush() {

    var selectedMetabolite = $('#compound').val();
    var data = Dashboard.metabolites[selectedMetabolite].All.OrderAll;
    var dMin = d3.min(data);
    var dMax = d3.max(data);
    var margin = {top: 0, right: 60, bottom: 20, left: 60},
        width = null,
        height = 50 - margin.top - margin.bottom;

    $('#contextBrush').prepend("<div class='row'>" +
        "<div class='span00 text-center'>" +
        "<p><span class='label label-info'>Select sample order window to zoom-in</span></p>" +
        "</div></div>");


    var svg = d3.select("#contextBrush svg")

    var availableWidth = (width || parseInt(svg.style('width')) || 960) - margin.left - margin.right;

    svg.attr("width", availableWidth + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom + 10)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scale.linear()
        .domain([dMin, dMax])
        .range([0, availableWidth]);

    var y = d3.random.normal(height / 2, height / 8);

    var brush = d3.svg.brush()
        .x(x)
        //.extent([20, 100])
        .on("brushstart", brushstart)
        .on("brush", brushmove)
        .on("brushend", brushend);

    var arc = d3.svg.arc()
        .outerRadius(height / 2)
        .startAngle(0)
        .endAngle(function (d, i) {
            return i ? -Math.PI : Math.PI;
        });

    var g = svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickFormat(d3.format('d'))
            //.tickSize(10)
            //.tickPadding(9)
        );

    var axisLabel = g.append('text')
        .attr("class", "nv-axislabel")
        .text("Order")
        .attr('text-anchor', 'middle')
        .attr('y', height)
        .attr('x', availableWidth / 2);

    var circle = svg.append("g").selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("r", 3.5)
        .attr("transform", function (d) {
            //console.log(d);
            return "translate(" + x(d) + "," + y() + ")";
        });


    var brushg = svg.append("g")
        .attr("class", "brush")
        .call(brush);

    brushg.selectAll(".resize").append("path")
        .attr("transform", "translate(0," + height / 2 + ")")
        .attr("d", arc);

    brushg.selectAll("rect")
        .attr("height", height);

    brushstart();
    brushmove();

    function brushstart() {
        svg.classed("selecting", true);
    }

    function brushmove() {
        var s = brush.extent();
        circle.classed("selected", function (d) {
            return s[0] <= d && d <= s[1];
        });
    }

    function brushend() {
        //svg.classed("selecting", !d3.event.target.empty());
        if (!d3.event.target.empty()) {
            var extent = brush.extent().map(Math.round);
            drawVisibleCharts(extent);
        } else {
            //reset all graphs
            drawVisibleCharts();
        }
    }
}