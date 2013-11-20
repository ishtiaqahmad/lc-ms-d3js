//var url = "https://dl.dropboxusercontent.com/s/afaxphho9v2rrhf/Dashboard.json";
var url = 'data/metabolomics.json';
var shapes = ['circle', 'cross', 'triangle-up', 'triangle-down', 'diamond', 'square'], random = d3.random.normal();
var Dashboard, elm, gState = {}, firstChartLegend, mainLegend;
var jsonObj;
var qcFitRatioChart, isAreaChart, focusChart;

var chartsSettingArr = {   // charts array and its default values
    ratioChart: {
        key: 'Ratio',
        sampleType: 'Sample',
        groupBy: 'Batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Ratio (uncorrected)',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    ratioQChart: {
        key: 'RatioQ',
        sampleType: 'Sample',
        groupBy: 'Batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Ratio (QC corrected)',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    areaChart: {
        key: 'Area',
        sampleType: 'Sample',
        groupBy: 'Batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Area',
        visible: true,
        chartObject: nv.models.scatterChart()
    },
    rtChart: {
        key: 'RT',
        sampleType: 'Sample',
        groupBy: 'Batch',
        xAxisLabel: 'Order',
        yAxisLabel: 'Retention Time',
        visible: true,
        chartObject: nv.models.scatterChart()
    }
};

//Array.prototype.clean = function (deleteValue) {
//    for (var i = 0; i < this.length; i++) {
//        if (this[i] == deleteValue) {
//            this.splice(i, 1);
//            i--;
//        }
//    }
//    return this;
//};

String.prototype.hashCode = function () {
    var hash = 0, i, char;
    if (this.length == 0) return hash;
    for (i = 0, l = this.length; i < l; i++) {
        char = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

function getBatch(element) {
    return element.series.originalPos ? Dashboard.Info.Batch[element.series.originalPos[element.pointIndex]] : Dashboard.Info.Batch[element.point.x];
}

function getSampLabel(element) {
    return element.series.originalPos ? Dashboard.Info.Label[element.series.originalPos[element.pointIndex]] : Dashboard.Info.Label[element.point.x];
}
function tooltipContent(key, x, y, e, graph) {
    //console.log(key, x, y, e)
    //"<span class='badge badge-success'> " + key +"</span>"
    return '<h3>' + key + '</h3>' +
        '<p>Batch :' + getBatch(e) + ' Sample :' + getSampLabel(e) + '</p>' +
        '<p>' + e.point.y + ' on ' + e.point.x + '</p>';
}
/*
 * TODo
 * implement efficient way to find min/max
 * var max_of_array = Math.max.apply(Math, array);
 */
function getMinMax(data) {
    var minY, maxY, minX, maxX;
    minY = 1000000, maxY = -1000000;
    minX = 1000000, maxX = -1000000;
    data.forEach(function (d) {
        if (d.values.length) {
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
    var metabolite = dashboard.Metabolite[metIdx];
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

function filterAnalyte(dashboard, analyteType) {
    var analyteTypeObj = eval('dashboard.' + analyteType);

    if (!analyteTypeObj) {
        console.error("analyteType:" + analyteType + " does not exist");
        console.error("Object does not have property name:", analyteType);
        return
    } else if (!analyteTypeObj instanceof Array || analyteTypeObj.length == 0) {
        console.error("Not an analyte or its an empty Array");
        return
    }
    return analyteTypeObj
}

function filterAnalyteResponse(analyteArr, metIdx, response) {
    var analyte = analyteArr[metIdx];
    if (!analyte) {
        console.error("No analyte exist on this:", analyteArr, metIdx);
        return
    }
    var responseVals = eval('analyte.' + response);
    if (!responseVals) {
        console.error("No such response type exist:", response);
        return
    }
    return responseVals
}

function filterSampleType(sampleTypesArr, responseVals, sampleType) {
    if (!sampleTypesArr || !responseVals) {
        console.error("its is empty");
        return
    }
    var sampleTypeGroups = makeGroup(responseVals, sampleTypesArr);
    if (sampleType) {
        return sampleTypeGroups.filter(function (itm, i) {
            return itm.key == sampleType;
        });
    } else
        return sampleTypeGroups;
}

function makeGroup(responseVals, groupByObj) {
    if (responseVals.length != groupByObj.length) {
        console.error("Data responseVals and groupByObj does not correspond to same length!", responseVals.length, groupByObj.length);
        return
    }
    if (!groupByObj) {
        console.error("No such group exist in dashboard.Info:", groupByObj);
        console.error("Sending back data without groping");
        return responseVals;
    }

    var groups = [];
    var nGroups = groupByObj.filter(function (itm, i, groupByObj) {
        return i == groupByObj.indexOf(itm);
    });

    $.each(nGroups, function (i, currentGroup) {
        var pos = []
        var g = responseVals.filter(function (itm, index) {
            if (currentGroup == groupByObj[index]) {
                pos.push(index)
                return true
            } else {
                return false
            }
        });
        groups.push({
            key: currentGroup,
            values: g,
            originalPos: pos
        });

        /*
         groups.push({
         group: currentGroup,
         values: new Array(responseVals.length)
         });

         for (var j = 0; j < responseVals.length; j++) {
         if (currentGroup == groupByObj[j])
         groups[i].values[j] = responseVals[j];
         }
         */
    });

    return groups;
}

function makeSubGroup(alreadyGroupedObj, groupByArr) {
    var groups = [];
    var nGroups = groupByArr.filter(function (itm, i, groupByArr) {
        return i == groupByArr.indexOf(itm);
    });

    $.each(nGroups, function (i, currentGroup) {
        var pos = []
        var g = alreadyGroupedObj.values.filter(function (itm, index) {
            if (currentGroup == groupByArr[alreadyGroupedObj.originalPos[index]]) {
                pos.push(alreadyGroupedObj.originalPos[index])
                return true
            } else {
                return false
            }
        });
        groups.push({
            key: currentGroup,
            values: g,
            originalPos: pos
        });
    });

    return groups;
}

function indexDataStream(vectorX, vectorY) {
    /*
     if (vectorX.length != vectorY.length) {
     console.error("Data X and Y does not correspond to same length!", vectorX.length, vectorY.length);
     return
     }
     */
    return vectorY.map(function (yd, i) {
        return {x: vectorX[i], y: yd }
    });
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
    var chartId = 'Graph' + setting.Title.hashCode();
    if ($('#' + chartId).length) {
        $('#' + chartId).remove();
    }  //else does not exist

}

function updateGraph(data, setting, chartOptions) {
    var chartId = 'Graph' + setting.Title.hashCode();
    if ($('#' + chartId).length) {
        var chart = setting.chartObject;
        if (chart) {
            chart.options(chartOptions);
            d3.select('#' + chartId + ' svg')
                .datum(data)
                .transition().duration(500)
                .call(chart);
        } else {
            console.error("UpdateError:Chart object does not exist ");
        }
    } else {
        // does not exist create it instead
    }

}

Event.subscribe = function (args) {
    if (args) {
        d3.map(args).forEach((function (key, value) {
            if (typeof this[key] === "function") {
                this[key](value);
            }
        }).bind(this));
    }
    return this;
};

function updateStates(newState) {
    //console.log('newState?', newState);
    d3.map(Dashboard.PlotInfo.Plots).forEach((function (key, value) {
        if (typeof value.chartObject === "function") {
            value.chartObject.dispatch.changeState(newState);
            value.chartObject.update();
        }
    }));

//    Dashboard.PlotInfo.Plots[0].chartObject.dispatch.changeState({disabled: [true, true, false, false, false, false]});
//    //Dashboard.PlotInfo.Plots[0].chartObject.state({disabled: [true, true, false, false, false, false]});
//    Dashboard.PlotInfo.Plots[0].chartObject.update();
}
function subscribeScatterPlotEvent(chart) {
    chart.scatter.dispatch.on('elementMouseout', function (_) {
        setTimeout(function () {
            if (elm && elm.seriesIndex == _.seriesIndex && elm.pointIndex == _.pointIndex) {
                //chart.scatter.highlightPoint(_.seriesIndex, _.pointIndex, true);
                $.each(Dashboard.PlotInfo.Plots, function (idx, chartSetting) {
                    if (chartSetting.visible) {
                        if (chartSetting.chartObject.scatter) {
                            chartSetting.chartObject.scatter.clearHighlights();
                            chartSetting.chartObject.scatter.highlightPoint(_.seriesIndex, _.pointIndex, true);
                        }
                    }
                });
            }
        }, 100);

    });
    chart.scatter.dispatch.on('elementClick', function (_) {
        elm = _;
        //chart.scatter.clearHighlights();
    });

    chart.dispatch.on('stateChange', function (_) {
        updateStates(_)
        setTimeout(function () {
            updateStates(_)
        }, 50);
    });

    chart.dispatch.on('changeState', function (_) {
        //console.log('changeState?', _);
    });
}

function drawGraph(data, setting, chartOptions, eventFunc) {
    var chartId = 'Graph' + setting.Title.hashCode();
//    if ($('#' + chartId).length) {  // exist update it instead
//        updateGraph(data, setting, chartOptions);
//
//    } else {
    if ($('#' + chartId).length)
        removeGraph(setting)

    $('<div/>', {
        "class": "dashboardChart",
        title: setting.Title + 'Graph',
        id: chartId
    }).appendTo('#DashboardChartArea').prepend('<svg/>');

    $('#' + chartId).prepend("<div class='row'>" +
        "<div class='span00 text-center'>" +
        "<p><span class='label label-important'>" + setting.Title + " Chart</span></p>" +
        "</div></div>");

    var gp = function () {
        var chart = setting.chartObject;
        chart.options(chartOptions);
        chart.xAxis
            .tickFormat(d3.format('d'))
            .showMaxMin(true)
            .axisLabel(setting.xAxisLabel);

        if (chart.yAxis)
            chart.yAxis
                .tickFormat(d3.format('.02f'))
                .axisLabel(setting.yAxisLabel);
        if (chart.yAxis1)
            chart.yAxis1
                .tickFormat(d3.format('.02f'))
                .axisLabel(setting.yAxisLabel);
        if (chart.yAxis2)
            chart.yAxis2
                .tickFormat(d3.format('.02f'))
                .axisLabel(setting.yAxis2Label);

        if (chart.multibar) {
            chart.multibar.hideable(true);
            var axisScale = d3.scale.linear()
                .domain([0, 211])
                .range([0, 211]);
            chart.xAxis
                .scale(axisScale)
                .tickFormat(d3.format('d'))
                .showMaxMin(true)
                .axisLabel(setting.xAxisLabel);
        }

        if (chart.lines1)
            chart.lines1.scatter.shape(shapes[5]);

        if (chart.scatter1)
            chart.scatter1.sizeDomain([100, 100])
                .sizeRange([100, 100]);
        if (chart.scatter2)
            chart.scatter2.sizeDomain([100, 100])
                .sizeRange([100, 100]);

        chart.tooltipContent(tooltipContent);

        d3.select('#' + chartId + ' svg')
            .datum(data)
            .transition().duration(500)
            .call(chart);
        nv.utils.windowResize(chart.update);

//            chart.dispatch.on('stateChange', function (e) {
//                console.log('New State:', JSON.stringify(e));
//            });

        if (typeof eventFunc === "function")
            eventFunc(chart);

        setting.chartObject = chart;
        return chart;
    }
    nv.addGraph(gp);
    //}
}
//
//function drawVisibleCharts(extent) {
//    $.each(Object.keys(chartsSettingArr), function (idx, ch) {
//        var chartSetting = eval('chartsSettingArr.' + ch);
//        var selectedMetabolite = $('#compound').val();
//        if (chartSetting.visible) {
//            /*
//             var btData = filterMetaboliteData(Dashboard, selectedMetabolite, chartSetting.sampleType, chartSetting.key, chartSetting.groupBy);
//             var qcSampleData = filterMetaboliteData(Dashboard, selectedMetabolite, 'QCsample', chartSetting.key);
//             qcSampleData = $.extend(qcSampleData[0], {color: 'black', slope: 1});
//             btData = btData.concat(qcSampleData);
//             */
//            var allRespVal = filterAnalyteResponse(filterAnalyte(Dashboard, 'Metabolite'), selectedMetabolite, chartSetting.key);
//            var groupByObj = Dashboard.Info.Type;
//            var xAxisData = Dashboard.Info.Order;
//            var sampleTypeGroups = makeGroup(allRespVal, groupByObj); // group by sample type i.g. sample, QCsample, blank etc.
//            var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {  // only copy the required sampleType in this case Sample
//                return itm.key == chartSetting.sampleType;
//            })[0];
//
//            // sub groups (i.e. batch, duplo etc.) within top level sample type group
//            var groupBy = makeGroup(eval('Dashboard.Info.' + chartSetting.groupBy), groupByObj).filter(function (itm, i) {
//                return itm.key == chartSetting.sampleType;
//            })[0];
//
//            var sampleType_subGroups = makeGroup(sampleType_sampleData.values, groupBy.values);
//            var btData = sampleType_subGroups.map(function (g) {
//                return {
//                    key: chartSetting.groupBy + ' ' + g.key,
//                    values: g.values.map(function (val, i) {
//                        return {x: xAxisData[allRespVal.indexOf(val)], y: val }
//                    })
//                }
//            })
//
//            var sampleType_qcSampleData = sampleTypeGroups.filter(function (itm, i) {
//                return itm.key == 'QCsample';
//            })[0];
//
//            sampleType_qcSampleData.values = sampleType_qcSampleData.values.map(function (val, i) {
//                return {x: xAxisData[allRespVal.indexOf(val)], y: val }
//            });
//
//            sampleType_qcSampleData = $.extend(sampleType_qcSampleData, {color: 'black', slope: 1});
//
//            btData = btData.concat(sampleType_qcSampleData);
//
//            /*
//             var data = [];
//             var qcData = indexDataStream(Dashboard.Info.Order, qcSampleData[0].values);
//             var mean = d3.mean(qcSampleData[0].values);
//             var v = variance(qcSampleData[0].values);
//
//             data.push({
//             key: 'QCsample',
//             color: 'black',
//             mean: mean,
//             variance: v,
//             values: qcData
//             });
//             */
//
//            /*
//             *  pre-filter the final data before actual drawing
//             *   filter orderAll only between brush extent i.e. [2, 30]
//             */
//            if (extent) {
//                btData.map(function (d) {
//                    d.values = d.values.filter(function (d) {
//                        return extent[0] <= d.x && d.x <= extent[1];
//                    });
//                    return d;
//                });
//            }
//            drawGraph(btData, chartSetting);
//        } else {
//            // remove it from dom element
//            removeGraph(chartSetting);
//        }
//
//    });
//
//}

function drawVisibleCharts(extent) {
    var selectedMetabolite = $('#compound').val();
    var selectedGroup = Dashboard.PlotInfo.Group[0];
    $.each(Dashboard.PlotInfo.Plots, function (idx, chartSetting) {
            if (chartSetting.visible == undefined)
                chartSetting = $.extend(chartSetting, {visible: true});

            if (chartSetting.ChartType == "Scatter")
                chartSetting = $.extend(chartSetting, {chartObject: nv.models.scatterChart()});
            else if (chartSetting.ChartType == "Multi")
                chartSetting = $.extend(chartSetting, {chartObject: nv.models.multiChart()});
            else if (chartSetting.ChartType == "Bar")
                chartSetting = $.extend(chartSetting, {chartObject: nv.models.multiChart()});
            // @TODO push each chart for highlight points events
            // chartsSettingArr.push(chartSetting);

            if (chartSetting.visible && chartSetting.ChartType == "Bar") {
                //@TODO
                //implement filterAnalyteResponse in generic way
                var btData;
                if (chartSetting.Yfield == "ISTD") {
                    var metabolite = Dashboard.Metabolite[selectedMetabolite];
                    var istd = Dashboard.ISTD.filter(function (itm, i) {
                        return itm.Name == metabolite.ISTD;
                    })[0];
                    var allRespVal = eval('istd.' + chartSetting.Ydata);
                    var groupByType = eval('Dashboard.' + chartSetting.Xfield + '.Type');
                    var xAxisData = eval('Dashboard.' + chartSetting.Xfield + '.' + chartSetting.Xdata);
                    var sampleTypeGroups = makeGroup(allRespVal, groupByType);
                    var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
                        return itm.key != chartSetting.sampleType;
                    });

                    btData = groups_excluding_sample.map(function (g) {
                        return {
                            type: 'bar',
                            yAxis: 1,
                            key: g.key,
                            color: g.key == 'QCsample' ? 'black' : undefined,
                            values: g.values.map(function (val, i) {
                                return {x: xAxisData[g.originalPos[i]], y: val }
                            })
                        }
                    });

                    //select the Sample group
                    var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {
                        return itm.key == chartSetting.sampleType;
                    })[0];
                    // make its sub groups on Batch
                    var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));
                    btData = btData.concat(sampleType_subGroups.map(function (g) {
                        return {
                            type: 'bar',
                            yAxis: 1,
                            key: selectedGroup + ' ' + g.key,
                            values: g.values.map(function (val, i) {
                                return {x: xAxisData[g.originalPos[i]], y: val }
                            })
                        }
                    }));

                    //console.log(btData, negative_test_data)
//                defaultChartConfig("chart2", btData, {
//                    delay: 50,
//                    reduceXTicks: true,
//                    transitionDuration: 0,
//                    groupSpacing: 0.2
//                });
                }
                else if (chartSetting.Yfield == "Metabolite") {
                    var metabolite = Dashboard.Metabolite[selectedMetabolite];

                    var allRespVal = eval('metabolite.' + chartSetting.Ydata);
                    var groupByType = eval('Dashboard.' + chartSetting.Xfield + '.Type');
                    var xAxisData = eval('Dashboard.' + chartSetting.Xfield + '.' + chartSetting.Xdata);
                    var sampleTypeGroups = makeGroup(allRespVal, groupByType);
                    var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
                        return itm.key != chartSetting.sampleType;
                    });

                    btData = groups_excluding_sample.map(function (g) {
                        return {
                            type: 'bar',
                            yAxis: 1,
                            key: g.key,
                            color: g.key == 'QCsample' ? 'black' : undefined,
                            values: g.values.map(function (val, i) {
                                return {x: xAxisData[g.originalPos[i]], y: val }
                            })
                        }
                    });

                    //select the Sample group
                    var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {
                        return itm.key == chartSetting.sampleType;
                    })[0];
                    // make its sub groups on Batch
                    var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));
                    btData = btData.concat(sampleType_subGroups.map(function (g) {
                        return {
                            type: 'bar',
                            yAxis: 1,
                            key: selectedGroup + ' ' + g.key,
                            values: g.values.map(function (val, i) {
                                return {x: xAxisData[g.originalPos[i]], y: val }
                            })
                        }
                    }));


                    //console.log(btData, negative_test_data)
//                defaultChartConfig("chart2", btData, {
//                    delay: 50,
//                    reduceXTicks: true,
//                    transitionDuration: 0,
//                    groupSpacing: 0.2
//                });
                }

                /*
                 *  pre-filter the final data before actual drawing
                 *   filter orderAll only between brush extent i.e. [2, 30]
                 */
                if (extent) {
                    btData = btData.map(function (s) {
                        s.values = s.values.filter(function (d) {
                            return extent[0] <= d.x && d.x <= extent[1];
                        });
                        return s;
                    });
                }
                btData = btData.map(function (g) {
                    g.values = g.values.filter(function (itm, i) {
                        return itm.y != null
                    })
                    return g;
                });

                var minMax = getMinMax(btData);
                drawGraph(btData, chartSetting, {
                    //barColor: nv.utils.defaultColor(),
                    transitionDuration: 50,
                    delay: 5,
                    showControls: false,
                    //color: nv.utils.defaultColor(),
                    //forceX: [0, 211],
                    groupSpacing: 0,
                    reduceXTicks: true
                });
                return
            } else if (chartSetting.visible && chartSetting.ChartType == "Scatter") {
                var btData;
                if (chartSetting.Yvalues != null && chartSetting.Xvalues != null) {  // e.g. PCA chart is special case Scatter plot
                    var groupByType = Dashboard.Info.Type;
                    var order = Dashboard.Info.Order;
                    var pca_sampleTypeGroups = makeGroup(chartSetting.Yvalues, groupByType);

                    var pca_groups_excluding_sample = pca_sampleTypeGroups.filter(function (itm, i) {
                        return itm.key != chartSetting.sampleType;
                    });

                    btData = pca_groups_excluding_sample.map(function (g) {
                        return {
                            key: g.key,
                            color: g.key == 'QCsample' ? 'black' : '',
                            originalPos: g.originalPos,
                            values: g.values.map(function (val, i) {
                                return {x: chartSetting.Xvalues[g.originalPos[i]], y: val }
                            })
                        }
                    });

                    //select the Sample group
                    var pca_sampleType_sampleData = pca_sampleTypeGroups.filter(function (itm, i) {
                        return itm.key == chartSetting.sampleType;
                    })[0];
                    // make its sub groups on Batch
                    var pca_sampleType_subGroups = makeSubGroup(pca_sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));
                    btData = btData.concat(pca_sampleType_subGroups.map(function (g) {
                        return {
                            key: selectedGroup + ' ' + g.key,
                            originalPos: g.originalPos,
                            values: g.values.map(function (val, i) {
                                return {x: chartSetting.Xvalues[g.originalPos[i]], y: val }
                            })
                        }
                    }));

                    /*
                     *  pre-filter the final data before actual drawing
                     *   filter orderAll only between brush extent i.e. [2, 30]
                     */
                    if (extent) {
                        btData = btData.map(function (s) {
                            s.values = s.values.filter(function (d, i) {
                                return extent[0] <= order[s.originalPos[i]] && order[s.originalPos[i]] <= extent[1];
                            });
                            return s;
                        });
                    }

                    btData = btData.map(function (g) {
                        g.values = g.values.filter(function (itm) {
                            return (itm.y != null && itm.x != null)
                        })
                        return g;
                    });

                    var minMax = getMinMax(btData);
                    drawGraph(btData, chartSetting, {
                        showDistX: true,
                        showDistY: true,
                        useVoronoi: true,
                        color: d3.scale.category20().range(),
                        sizeDomain: [100, 100],
                        sizeRange: [100, 100]
                        //forceY: [(minMax.minY - minMax.minY * .1 ), (minMax.maxY + minMax.maxY * .1 )],
                        //forceX: [minMax.minX , minMax.maxX]

                    }, subscribeScatterPlotEvent);
                    return
                }
                var allRespVal = filterAnalyteResponse(filterAnalyte(Dashboard, chartSetting.Yfield), selectedMetabolite, chartSetting.Ydata);
                var groupByType = eval('Dashboard.' + chartSetting.Xfield + '.Type');
                var xAxisData = eval('Dashboard.' + chartSetting.Xfield + '.' + chartSetting.Xdata);

                var sampleTypeGroups = makeGroup(allRespVal, groupByType); // group by sample type i.g. sample, QCsample, blank etc.

                var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
                    return itm.key != chartSetting.sampleType;
                });

                btData = groups_excluding_sample.map(function (g) {
                    return {
                        key: g.key,
                        color: g.key == 'QCsample' ? 'black' : '',
                        values: g.values.map(function (val, i) {
                            return {x: xAxisData[g.originalPos[i]], y: val }
                        })
                    }
                });

                var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {  // only copy the required sampleType in this case Sample
                    return itm.key == chartSetting.sampleType;
                })[0];

                // sub groups (i.e. batch, duplo etc.) within top level sample type group
                var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.' + chartSetting.Xfield + '.' + selectedGroup));
                btData = btData.concat(sampleType_subGroups.map(function (g) {
                    return {
                        key: selectedGroup + ' ' + g.key,
                        values: g.values.map(function (val, i) {
                            return {x: xAxisData[g.originalPos[i]], y: val }
                        })
                    }
                }));

                /*
                 *  pre-filter the final data before actual drawing
                 *   filter orderAll only between brush extent i.e. [2, 30]
                 */
                if (extent) {
                    btData = btData.map(function (s) {
                        s.values = s.values.filter(function (d) {
                            return extent[0] <= d.x && d.x <= extent[1];
                        });
                        return s;
                    });
                }

                btData = btData.map(function (g) {
                    g.values = g.values.filter(function (itm, i) {
                        return itm.y != null
                    })
                    return g;
                });
                var minMax = getMinMax(btData);
                drawGraph(btData, chartSetting, {
                    showDistX: false,
                    showDistY: false,
                    useVoronoi: true,
                    color: d3.scale.category20().range(),
                    sizeDomain: [100, 100],
                    sizeRange: [100, 100],
                    //forceY: [(minMax.minY - minMax.minY * .1 ), (minMax.maxY + minMax.maxY * .1 )],
                    forceX: [minMax.minX , minMax.maxX]
                }, subscribeScatterPlotEvent);
            } else if (chartSetting.visible && chartSetting.ChartType == "Multi") {
                var btData = [];
                var respQCtrend, respSetYfield = [], respSetYfield2 = [];
                //console.log("chartSetting?", chartSetting)
                if (chartSetting.Yfield) {
                    //check Ydata might be an array
                    if (chartSetting.Ydata instanceof Array) {
                        chartSetting.Ydata.forEach(function (d, i) {
                            respSetYfield.push({
                                type: chartSetting.SubType[i],
                                values: filterAnalyteResponse(filterAnalyte(Dashboard, chartSetting.Yfield), selectedMetabolite, d)
                            });
                        })
                    } else if (chartSetting.Ydata) {
                        respSetYfield.push({
                            type: chartSetting.SubType[0],
                            values: filterAnalyteResponse(filterAnalyte(Dashboard, chartSetting.Yfield), selectedMetabolite, chartSetting.Ydata)
                        });
                    }

                }
                if (chartSetting.Yfield2) {
                    if (chartSetting.Ydata2 instanceof Array) {
                        chartSetting.Ydata2.forEach(function (d, i) {
                            respSetYfield2.push({
                                type: chartSetting.SubType[i],
                                values: filterAnalyteResponse(filterAnalyte(Dashboard, chartSetting.Yfield2), selectedMetabolite, d)
                            });
                        })
                    } else if (chartSetting.Ydata2) {
                        respSetYfield2.push({
                            type: chartSetting.SubType[1],
                            values: filterAnalyteResponse(filterAnalyte(Dashboard, chartSetting.Yfield2), selectedMetabolite, chartSetting.Ydata2)
                        });
                    }

                }

                var groupByType = eval('Dashboard.' + chartSetting.Xfield + '.Type');
                var xAxisData = eval('Dashboard.' + chartSetting.Xfield + '.' + chartSetting.Xdata);

                if (respSetYfield.length > 0) {
                    respSetYfield = respSetYfield.map(function (respSet) {
                        if (respSet.type.toLowerCase() != 'line') {  // in case of line no grouping
                            var sampleTypeGroups = makeGroup(respSet.values, groupByType);
                            var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
                                return itm.key != chartSetting.sampleType;
                            });
                            var result = groups_excluding_sample.map(function (g) {
                                return {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 1,
                                    key: g.key,
                                    color: g.key == 'QCsample' ? 'black' : undefined,
                                    values: g.values.map(function (val, i) {
                                        return {x: xAxisData[g.originalPos[i]], y: val }
                                    })
                                }
                            });

                            var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {
                                return itm.key == chartSetting.sampleType;
                            })[0];
                            var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));
                            respSet.values = result.concat(sampleType_subGroups.map(function (g) {
                                return {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 1,
                                    key: selectedGroup + ' ' + g.key,
                                    values: g.values.map(function (val, i) {
                                        return {x: xAxisData[g.originalPos[i]], y: val }
                                    })
                                }
                            }));
                            return respSet;
                        } else {
                            var k = chartSetting.Yfield.concat("-".concat(chartSetting.Ydata instanceof Array ? chartSetting.Ydata[1] : chartSetting.Ydata));
                            respSet.values = [
                                {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 1,
                                    key: k,
                                    values: respSet.values.map(function (g, i) {
                                        return    {x: xAxisData[i], y: g }
                                    })
                                }
                            ]
                            return respSet;
                        }
                    });
                }
                if (respSetYfield2.length > 0) {
                    respSetYfield2 = respSetYfield2.map(function (respSet) {
                        if (respSet.type.toLowerCase() != 'line') {  // in case of line no grouping
                            var sampleTypeGroups = makeGroup(respSet.values, groupByType);
                            var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
                                return itm.key != chartSetting.sampleType;
                            });
                            var result = groups_excluding_sample.map(function (g) {
                                return {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 2,
                                    key: g.key,
                                    color: g.key == 'QCsample' ? 'black' : undefined,
                                    values: g.values.map(function (val, i) {
                                        return {x: xAxisData[g.originalPos[i]], y: val }
                                    })
                                }
                            });

                            var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {
                                return itm.key == chartSetting.sampleType;
                            })[0];
                            var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));
                            respSet.values = result.concat(sampleType_subGroups.map(function (g) {
                                return {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 2,
                                    key: selectedGroup + ' ' + g.key,
                                    values: g.values.map(function (val, i) {
                                        return {x: xAxisData[g.originalPos[i]], y: val }
                                    })
                                }
                            }));
                            return respSet;
                        } else {
                            var k = chartSetting.Yfield2.concat("-".concat(chartSetting.Ydata2 instanceof Array ? chartSetting.Ydata2[1] : chartSetting.Ydata2));
                            respSet.values = [
                                {
                                    type: respSet.type.toLowerCase(),
                                    yAxis: 2,
                                    key: k,
                                    values: respSet.values.map(function (g, i) {
                                        return    {x: xAxisData[i], y: g }
                                    })
                                }
                            ]
                            return respSet;
                        }
                    });
                }
                //console.log(respSetYfield2);
                respSetYfield.map(function (respSet) {
                    btData = btData.concat(respSet.values.map(function (val) {
                        return val;
                    }))
                })
                respSetYfield2.map(function (respSet) {
                    btData = btData.concat(respSet.values.map(function (val) {
                        return val;
                    }))
                })
                //console.log(btData)

                /*
                 *  pre-filter the final data before actual drawing
                 *   filter orderAll only between brush extent i.e. [2, 30]
                 */
                if (extent) {
                    btData = btData.map(function (s) {
                        s.values = s.values.filter(function (d) {
                            return extent[0] <= d.x && d.x <= extent[1];
                        });
                        return s;
                    });
                }
                // filter all NULL
                btData = btData.map(function (g) {
                    g.values = g.values.filter(function (itm, i) {
                        return itm.y != null
                    })
                    return g;
                });
                if (btData.length > 0) {
                    var minMax = getMinMax(btData);
                    drawGraph(btData, chartSetting, {
                        margin: {top: 30, right: (respSetYfield2.length > 0) ? 75 : 20, bottom: 50, left: 75},
                        showDistX: false,
                        showDistY: false,
                        useVoronoi: true,
                        color: d3.scale.category20().range(),
                        //forceY: [(minMax.minY - minMax.minY * .1 ), (minMax.maxY + minMax.maxY * .1 )],
                        forceX: [minMax.minX , minMax.maxX]
                    });
                }

                return
            }
            else {
                // remove it from dom element
                removeGraph(chartSetting);
            }

        }
    )
    ;

}

function drawLegend() {
    var selectedMetabolite = $('#compound').val();
    var selectedGroup = Dashboard.PlotInfo.Group[0];
    var metabolite = Dashboard.Metabolite[selectedMetabolite];
    var allRespVal = metabolite.RT;
    var groupByType = Dashboard.Info.Type;
    var sampleType = 'Sample';
    var sampleTypeGroups = makeGroup(allRespVal, groupByType);

    var groups_excluding_sample = sampleTypeGroups.filter(function (itm, i) {
        return itm.key != sampleType;
    });

    var result = groups_excluding_sample.map(function (g) {
        return {
            key: g.key
        }
    });

    var sampleType_sampleData = sampleTypeGroups.filter(function (itm, i) {
        return itm.key == sampleType;
    })[0];

    var sampleType_subGroups = makeSubGroup(sampleType_sampleData, eval('Dashboard.Info.' + selectedGroup));

    result = result.concat(sampleType_subGroups.map(function (g) {
        return {
            key: selectedGroup + ' ' + g.key
        }
    }));

    nv.addGraph({
        generate: function () {
            var width = 500,
                height = 20;

            var chart = nv.models.legend()
                .width(width)
                .height(height);

            chart.dispatch.on('legendClick', function (d, i) {
                console.log(d, i)
            });
            chart.dispatch.on('stateChange', function (d) {
                console.log('stateChange?', d);
//                setTimeout(function () {
//                    updateStates(_)
//                   // updateStates(_)
//                }, 100);
            });

            d3.select('#mainLegend')
                .attr('width', width)
                .attr('height', height)
                .datum(result)
                .call(chart);

            mainLegend = chart
            return chart;
        },
        callback: function (graph) {
            var chart = graph,
                height = chart.height(),
                width = chart.width();

            d3.select('#mainLegend')
                .attr('width', width)
                .attr('height', height)
                .call(chart)
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
            var chart = nv.models.multiChart()
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
            var chart = nv.models.multiChart()
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
    var data = Dashboard.Info.Order;
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