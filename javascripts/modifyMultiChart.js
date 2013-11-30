nv.models.multiChart = function () {
    "use strict";
    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 30, right: 20, bottom: 50, left: 75},
        color = nv.utils.defaultColor(),
        width = null,
        height = null,
        showLegend = true,
        tooltips = true,
        tooltip = function (key, x, y, e, graph) {
            return '<h3>' + key + '</h3>' +
                '<p>' + y + ' at ' + x + '</p>'
        },
        state = {},
        defaultState = null,
        x,
        y,
        id = Math.floor(Math.random() * 100000),
        noData = "No Data Available.",
        transitionDuration = 250,
        yDomain1,
        yDomain2
        ; //can be accessed via chart.lines.[x/y]Scale()

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var x = d3.scale.linear(),
        yScale1 = d3.scale.linear(),
        yScale2 = d3.scale.linear(),

        lines1 = nv.models.line().id(id).useVoronoi(false).yScale(yScale1),
        lines2 = nv.models.line().id(id).useVoronoi(false).yScale(yScale2),

        bars1 = nv.models.multiBar().id(id).stacked(false).yScale(yScale1),
        bars2 = nv.models.multiBar().id(id).stacked(false).yScale(yScale2),

        stack1 = nv.models.stackedArea().yScale(yScale1),
        stack2 = nv.models.stackedArea().yScale(yScale2),

        scatter1 = nv.models.scatter().id(id).yScale(yScale1),
        scatter2 = nv.models.scatter().id(id).yScale(yScale2),

        xAxis = nv.models.axis().scale(x).orient('bottom').tickPadding(5),
        yAxis1 = nv.models.axis().scale(yScale1).orient('left'),
        yAxis2 = nv.models.axis().scale(yScale2).orient('right'),

        legend = nv.models.legend(),
        dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'stateChange', 'changeState');

    var showTooltip = function (e, offsetElement) {
        var left = e.pos[0] + ( offsetElement.offsetLeft || 0 ),
            top = e.pos[1] + ( offsetElement.offsetTop || 0),
            x = xAxis.tickFormat()(lines1.x()(e.point, e.pointIndex)),
            y = ((e.series.yAxis == 2) ? yAxis2 : yAxis1).tickFormat()(lines1.y()(e.point, e.pointIndex)),
            content = tooltip(e.series.key, x, y, e, chart);

        nv.tooltip.show([left, top], content, e.value < 0 ? 'n' : 's', null, offsetElement);

    };

    function chart(selection) {
        selection.each(function (data) {
            var container = d3.select(this),
                that = this;
            var availableWidth = (width || parseInt(container.style('width')) || 960)
                    - margin.left - margin.right,
                availableHeight = (height || parseInt(container.style('height')) || 400)
                    - margin.top - margin.bottom;

            chart.update = function () {
                container.transition().duration(transitionDuration).call(chart);
            };
            chart.container = this;

            //set state.disabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            //------------------------------------------------------------
            // Display noData message if there's nothing to show.

            if (!data || !data.length || !data.filter(function (d) {
                return d.values.length
            }).length) {
                var noDataText = container.selectAll('.nv-noData').data([noData]);

                noDataText.enter().append('text')
                    .attr('class', 'nvd3 nv-noData')
                    .attr('dy', '-.7em')
                    .style('text-anchor', 'middle');

                noDataText
                    .attr('x', margin.left + availableWidth / 2)
                    .attr('y', margin.top + availableHeight / 2)
                    .text(function (d) {
                        return d
                    });

                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            //------------------------------------------------------------

            var dataLines1 = data.filter(function (d) {
                return !d.disabled && d.type == 'line' && d.yAxis == 1
            })
            var dataLines2 = data.filter(function (d) {
                return !d.disabled && d.type == 'line' && d.yAxis == 2
            })
            var dataBars1 = data.filter(function (d) {
                return !d.disabled && d.type == 'bar' && d.yAxis == 1
            })
            var dataBars2 = data.filter(function (d) {
                return !d.disabled && d.type == 'bar' && d.yAxis == 2
            })
            var dataStack1 = data.filter(function (d) {
                return !d.disabled && d.type == 'area' && d.yAxis == 1
            })
            var dataStack2 = data.filter(function (d) {
                return !d.disabled && d.type == 'area' && d.yAxis == 2
            })
            var dataScatter1 = data.filter(function (d) {
                return !d.disabled && d.type == 'scatter' && d.yAxis == 1
            })
            var dataScatter2 = data.filter(function (d) {
                return !d.disabled && d.type == 'scatter' && d.yAxis == 2
            })

            var series1 = data.filter(function (d) {
                return !d.disabled && d.yAxis == 1
            })
                .map(function (d) {
                    return d.values.map(function (d, i) {
                        return { x: d.x, y: d.y }
                    })
                })

            var series2 = data.filter(function (d) {
                return !d.disabled && d.yAxis == 2
            })
                .map(function (d) {
                    return d.values.map(function (d, i) {
                        return { x: d.x, y: d.y }
                    })
                })

            x.domain(d3.extent(d3.merge(series1.concat(series2)), function (d) {
                    return d.x
                }))
                .range([0, availableWidth]);

            //------------------------------------------------------------
            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.multiChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap multiChart nv-chart-' +id).append('g');

            // background for pointer events
            gEnter.append('rect').attr('class', 'nvd3 nv-background');

            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'y1 nv-y nv-axis');
            gEnter.append('g').attr('class', 'y2 nv-y nv-axis');
            gEnter.append('g').attr('class', 'lines1Wrap');
            gEnter.append('g').attr('class', 'lines2Wrap');
            gEnter.append('g').attr('class', 'bars1Wrap');
            gEnter.append('g').attr('class', 'bars2Wrap');
            gEnter.append('g').attr('class', 'scatter1Wrap');
            gEnter.append('g').attr('class', 'scatter2Wrap');
            gEnter.append('g').attr('class', 'stack1Wrap');
            gEnter.append('g').attr('class', 'stack2Wrap');
            gEnter.append('g').attr('class', 'nv-legendWrap');

            var g = wrap.select('g');

            if (showLegend) {
                legend.width(availableWidth);

                g.select('.nv-legendWrap')
                    .datum(data.map(function (series) {
                        series.originalKey = series.originalKey === undefined ? series.key : series.originalKey;
                        series.key = series.originalKey + (series.yAxis == 1 ? '' : ' (right axis)');
                        return series;
                    }))
                    .call(legend);

                if (margin.top != legend.height()) {
                    margin.top = legend.height();
                    availableHeight = (height || parseInt(container.style('height')) || 400)
                        - margin.top - margin.bottom;
                }

                g.select('.nv-legendWrap')
                    .attr('transform', 'translate(0,' + (-margin.top) + ')');
            }


            lines1
                .width(availableWidth)
                .height(availableHeight)
                .interpolate("monotone")
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'line'
                    }));

            lines2
                .width(availableWidth)
                .height(availableHeight)
                .interpolate("monotone")
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'line'
                    }));

            bars1
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'bar'
                    }));

            bars2
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'bar'
                    }));

            scatter1
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'scatter'
                    }));

            scatter2
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'scatter'
                    }));

            stack1
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'area'
                    }));

            stack2
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                        return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'area'
                    }));

            g.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');


            var lines1Wrap = g.select('.lines1Wrap')
                .datum(dataLines1)
            var bars1Wrap = g.select('.bars1Wrap')
                .datum(dataBars1)
            var stack1Wrap = g.select('.stack1Wrap')
                .datum(dataStack1)
            var scatter1Wrap = g.select('.scatter1Wrap')
                .datum(dataScatter1)

            var lines2Wrap = g.select('.lines2Wrap')
                .datum(dataLines2)
            var bars2Wrap = g.select('.bars2Wrap')
                .datum(dataBars2)
            var stack2Wrap = g.select('.stack2Wrap')
                .datum(dataStack2)
            var scatter2Wrap = g.select('.scatter2Wrap')
                .datum(dataScatter2)

            var extraValue1 = dataStack1.length ? dataStack1.map(function (a) {
                return a.values
            }).reduce(function (a, b) {
                    return a.map(function (aVal, i) {
                        return {x: aVal.x, y: aVal.y + b[i].y}
                    })
                }).concat([
                    {x: 0, y: 0}
                ]) : []
            var extraValue2 = dataStack2.length ? dataStack2.map(function (a) {
                return a.values
            }).reduce(function (a, b) {
                    return a.map(function (aVal, i) {
                        return {x: aVal.x, y: aVal.y + b[i].y}
                    })
                }).concat([
                    {x: 0, y: 0}
                ]) : []

            yScale1.domain(yDomain1 || d3.extent(d3.merge(series1).concat(extraValue1), function (d) {
                    return d.y
                }))
                .range([0, availableHeight])

            yScale2.domain(yDomain2 || d3.extent(d3.merge(series2).concat(extraValue2), function (d) {
                    return d.y
                }))
                .range([0, availableHeight])

            lines1.xDomain(x.domain())
            bars1.xDomain(x.domain())
            stack1.xDomain(x.domain())
            scatter1.xDomain(x.domain())

            lines2.xDomain(x.domain())
            bars2.xDomain(x.domain())
            stack2.xDomain(x.domain())
            scatter2.xDomain(x.domain())

            lines1.yDomain(yScale1.domain())
            bars1.yDomain(yScale1.domain())
            stack1.yDomain(yScale1.domain())
            scatter1.yDomain(yScale1.domain())

            lines2.yDomain(yScale2.domain())
            bars2.yDomain(yScale2.domain())
            stack2.yDomain(yScale2.domain())
            scatter2.yDomain(yScale2.domain())

            if (dataStack1.length) {
                d3.transition(stack1Wrap).call(stack1);
            }
            if (dataStack2.length) {
                d3.transition(stack2Wrap).call(stack2);
            }

            if (dataBars1.length) {
                d3.transition(bars1Wrap).call(bars1);
            }
            if (dataBars2.length) {
                d3.transition(bars2Wrap).call(bars2);
            }
            if (dataScatter1.length) {
                d3.transition(scatter1Wrap).call(scatter1);
            }
            if (dataScatter2.length) {
                d3.transition(scatter2Wrap).call(scatter2);
            }
            if (dataLines1.length) {
                d3.transition(lines1Wrap).call(lines1);
            }
            if (dataLines2.length) {
                d3.transition(lines2Wrap).call(lines2);
            }


            xAxis
                .scale(x)
                .ticks(xAxis.ticks() && xAxis.ticks().length ? xAxis.ticks() : availableWidth / 100)
                .tickSize(-availableHeight, 0);

            g.select('.nv-x.nv-axis')
                .attr('transform', 'translate(0,' + yScale1.range()[0] + ')')
                .call(xAxis);

            yAxis1
                .scale(yScale1)
                .ticks(yAxis1.ticks() && yAxis1.ticks().length ? yAxis1.ticks() : availableHeight / 36)
                .tickSize(-availableWidth, 0);


            g.select('.y1.nv-y.nv-axis')
                .call(yAxis1);

            yAxis2
                .scale(yScale2)
                .ticks(yAxis2.ticks() && yAxis2.ticks().length ? yAxis2.ticks() : availableHeight / 36)
                .tickSize(-availableWidth, 0);

            g.select('.y2.nv-y.nv-axis')
                .call(yAxis2);

            g.select('.y2.nv-y.nv-axis')
                .style('opacity', series2.length ? 1 : 0)
                .attr('transform', 'translate(' + x.range()[1] + ',0)');

            legend.dispatch.on('stateChange', function (newState) {
                state.disabled = newState.disabled;
                dispatch.stateChange(state);
                chart.update();
            });

            dispatch.on('tooltipShow', function (e) {
                if (tooltips) showTooltip(e, that.parentNode);
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function (e) {

                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function (series, i) {
                        series.disabled = e.disabled[i];
                    });

                    state.disabled = e.disabled;
                }

                chart.update();
            });

        });

        return chart;
    }


    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines1.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines1.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    lines2.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines2.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    bars1.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    bars1.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    bars2.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    bars2.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    stack1.dispatch.on('tooltipShow', function (e) {
        //disable tooltips when value ~= 0
        //// TODO: consider removing points from voronoi that have 0 value instead of this hack
        if (!Math.round(stack1.y()(e.point) * 100)) {  // 100 will not be good for very small numbers... will have to think about making this valu dynamic, based on data range
            setTimeout(function () {
                d3.selectAll('.point.hover').classed('hover', false)
            }, 0);
            return false;
        }

        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top],
            dispatch.tooltipShow(e);
    });

    stack1.dispatch.on('tooltipHide', function (e) {
        dispatch.tooltipHide(e);
    });

    stack2.dispatch.on('tooltipShow', function (e) {
        //disable tooltips when value ~= 0
        //// TODO: consider removing points from voronoi that have 0 value instead of this hack
        if (!Math.round(stack2.y()(e.point) * 100)) {  // 100 will not be good for very small numbers... will have to think about making this valu dynamic, based on data range
            setTimeout(function () {
                d3.selectAll('.point.hover').classed('hover', false)
            }, 0);
            return false;
        }

        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top],
            dispatch.tooltipShow(e);
    });

    stack2.dispatch.on('tooltipHide', function (e) {
        dispatch.tooltipHide(e);
    });

    scatter1.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    scatter1.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    scatter2.dispatch.on('elementMouseover.tooltip', function (e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    scatter2.dispatch.on('elementMouseout.tooltip', function (e) {
        dispatch.tooltipHide(e);
    });

    dispatch.on('tooltipHide', function () {
        if (tooltips) nv.tooltip.cleanup();
    });


    //============================================================
    // Global getters and setters
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.lines1 = lines1;
    chart.lines2 = lines2;
    chart.bars1 = bars1;
    chart.bars2 = bars2;
    chart.stack1 = stack1;
    chart.stack2 = stack2;
    chart.scatter1 = scatter1;
    chart.scatter2 = scatter2;
    chart.xAxis = xAxis;
    chart.yAxis1 = yAxis1;
    chart.yAxis2 = yAxis2;

    d3.rebind(chart, lines1, 'id', 'interactive', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'xRange', 'yRange', 'sizeDomain', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'useVoronoi', 'clipRadius', 'padData', 'highlightPoint', 'clearHighlights');
    d3.rebind(chart, lines2, 'id', 'interactive', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'xRange', 'yRange', 'sizeDomain', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'useVoronoi', 'clipRadius', 'padData', 'highlightPoint', 'clearHighlights');
    d3.rebind(chart, scatter1, 'id', 'interactive', 'pointActive', 'x', 'y', 'shape', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'xRange', 'yRange', 'sizeDomain', 'sizeRange', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'clipRadius', 'useVoronoi');
    d3.rebind(chart, scatter2, 'id', 'interactive', 'pointActive', 'x', 'y', 'shape', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'xRange', 'yRange', 'sizeDomain', 'sizeRange', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'clipRadius', 'useVoronoi');
    d3.rebind(chart, bars1, 'x', 'y', 'xDomain', 'yDomain', 'xRange', 'yRange', 'forceY', 'clipEdge', 'id', 'stacked', 'stackOffset', 'delay', 'barColor', 'groupSpacing');
    d3.rebind(chart, bars2, 'x', 'y', 'xDomain', 'yDomain', 'xRange', 'yRange', 'forceY', 'clipEdge', 'id', 'stacked', 'stackOffset', 'delay', 'barColor', 'groupSpacing');

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart.x = function (_) {
        if (!arguments.length) return getX;
        getX = _;
        lines1.x(_);
        bars1.x(_);
        scatter1.x(_);
        return chart;
    };

    chart.y = function (_) {
        if (!arguments.length) return getY;
        getY = _;
        lines1.y(_);
        bars1.y(_);
        scatter1.y(_);
        return chart;
    };

    chart.yDomain1 = function (_) {
        if (!arguments.length) return yDomain1;
        yDomain1 = _;
        return chart;
    };

    chart.yDomain2 = function (_) {
        if (!arguments.length) return yDomain2;
        yDomain2 = _;
        return chart;
    };

    chart.margin = function (_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.width = function (_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function (_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    chart.color = function (_) {
        if (!arguments.length) return color;
        color = nv.utils.getColor(_);
        legend.color(color);
        return chart;
    };

    chart.showLegend = function (_) {
        if (!arguments.length) return showLegend;
        showLegend = _;
        return chart;
    };

    chart.tooltips = function (_) {
        if (!arguments.length) return tooltips;
        tooltips = _;
        return chart;
    };

    chart.tooltipContent = function (_) {
        if (!arguments.length) return tooltip;
        tooltip = _;
        return chart;
    };

    chart.state = function (_) {
        if (!arguments.length) return state;
        state = _;
        return chart;
    };

    chart.defaultState = function (_) {
        if (!arguments.length) return defaultState;
        defaultState = _;
        return chart;
    };

    chart.noData = function (_) {
        if (!arguments.length) return noData;
        noData = _;
        return chart;
    };

    chart.transitionDuration = function (_) {
        if (!arguments.length) return transitionDuration;
        transitionDuration = _;
        return chart;
    };

    chart.id = function (_) {
        if (!arguments.length) return id;
        id = _;
        return chart;
    };
    return chart;
}

