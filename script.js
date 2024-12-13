let settingsState = {
  year: "All Time",
  country: "Worldwide",
};

const MAP_SIZE = 250;
Promise.all([
  d3.json("world.geojson"),
  d3.csv("yield_df.csv", d3.autoType),
]).then(function ([geoData, csvData]) {
  const yearDropdown = d3
    .select("#year-select")
    .append("select")
    .attr("id", "yearDropdown");
  const uniqueYears = Array.from(
    new Set([...csvData.map((row) => row.Year.toString()), "All Time"])
  ).sort((a, b) => b - a);
  yearDropdown
    .selectAll("option")
    .data(uniqueYears)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);
  yearDropdown.property("value", settingsState.year);
  yearDropdown.on("change", function () {
    settingsState.year = d3.select(this).property("value");
    updateVisualization(settingsState.year, settingsState.country);
  });

  const countryDropdown = d3
    .select("#country-select")
    .append("select")
    .attr("id", "countryDropdown");
  const uniqueCountries = Array.from(
    new Set([...csvData.map((row) => row.Area), "Worldwide"])
  ).sort();
  countryDropdown
    .selectAll("option")
    .data(uniqueCountries)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);
  countryDropdown.property("value", settingsState.country);
  countryDropdown.on("change", function () {
    settingsState.country = d3.select(this).property("value");
    updateVisualization(settingsState.year, settingsState.country);
  });

  updateVisualization(settingsState.year, settingsState.country);

  function updateVisualization(year, country) {
    // remove all charts before drawing again
    const filteredByYearData =
      year === "All Time"
        ? csvData
        : csvData.filter((row) => row.Year.toString() === year);
    const filteredByYearAndCountryData =
      country === "Worldwide"
        ? filteredByYearData
        : filteredByYearData.filter((row) => row.Area === country);
    const filteredByCountryData =
      country === "Worldwide"
        ? csvData
        : csvData.filter((row) => row.Area === country);
    drawAllMaps(geoData, filteredByYearData);
    drawPieChart(getPieChartData(filteredByYearAndCountryData), "#pie-chart");
    drawLineChart(getLineChartData(filteredByCountryData), "#line-chart");
    drawHeatmap(filteredByYearData, "#heatmap");
    // drawSpiderChart(parseSpiderChartData(csvData), "#spider-chart");
  }
});

const parseSpiderChartData = (rawData) => {
  // Parse the data into the required format for the spider chart.
  // Assuming we are interested in crop yields for each type of crop.
  const crops = ['Maize', 'Potatoes', 'Rice, paddy', 'Sorghum', 'Soybeans'];
  const parsedData = [];
  crops.forEach((crop) => {
    const cropData = rawData.filter((item) => item.Item === crop);
    if (cropData.length) {
      parsedData.push({
        color: getRandomColor(),
        values: cropData.map((item) => [
          item['average_rain_fall_mm_per_year'],
          item['pesticides_tonnes'],
          item['avg_temp'],
        ]).flat(),
      });
    }
  });
  return parsedData;
};

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const drawSpiderChart = (data, container) => {
  const width = 500;
  const height = 500;
  const radius = Math.min(width, height) / 2 - 50;
  const center = { x: width / 2, y: height / 2 };
  const maxValue = 1000;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const radialScale = d3.scaleLinear().domain([0, maxValue]).range([0, radius]);

  const axis = d3.axisRight().scale(radialScale).ticks(5);

  svg
    .append('g')
    .attr('transform', `translate(${center.x},${center.y - radius})`)
    .call(axis);

  for (let val = 0; val <= maxValue; val += maxValue / 5) {
    const r = radialScale(val);
    svg
      .append('circle')
      .attr('cx', center.x)
      .attr('cy', center.y)
      .attr('r', r)
      .style('stroke', '#aaa')
      .style('fill', 'none');
  }

  const labels = ['average_rain_fall_mm_per_year', 'pesticides_tonnes', 'avg_temp'];
  const anchors = ['middle', 'start', 'end'];
  const shifts = [
    { x: 0, y: -15 },
    { x: 10, y: 15 },
    { x: -10, y: 15 },
  ];

  for (let index = 0; index < labels.length; index++) {
    const angle = (index * Math.PI * 2) / labels.length;
    const x = center.x + radius * Math.sin(angle);
    const y = center.y + radius * -Math.cos(angle);
    if (angle > 0) {
      svg
        .append('line')
        .attr('x1', center.x)
        .attr('y1', center.y)
        .attr('x2', x)
        .attr('y2', y)
        .style('stroke', '#000');
    }
    svg
      .append('text')
      .text(labels[index])
      .attr('text-anchor', anchors[index])
      .attr('dx', shifts[index].x)
      .attr('dy', shifts[index].y)
      .attr('x', x)
      .attr('y', y);
  }

  data.forEach(({ color, values }) => {
    let path = '';
    for (let i = 0; i < values.length; i++) {
      const r = radialScale(values[i]);
      const angle = (i * Math.PI * 2) / values.length;
      const x = center.x + r * Math.sin(angle);
      const y = center.y + r * -Math.cos(angle);
      path += `${i > 0 ? 'L' : 'M'} ${x},${y} `;
    }
    path += 'Z';
    svg
      .append('path')
      .attr('d', path)
      .style('stroke', color)
      .style('stroke-width', 3)
      .style('stroke-opacity', 0.6)
      .style('fill', color)
      .style('fill-opacity', 0.3);
  });
};

// Function to filter data for pie chart
const getPieChartData = (data) => {
  return data
    .map((row) => ({ name: row.Item, value: row["hg/ha_yield"] }))
    .reduce((acc, curr) => {
      const existing = acc.find((item) => item.name === curr.name);
      if (existing) {
        existing.value += curr.value;
      } else {
        acc.push({ name: curr.name, value: curr.value });
      }
      return acc;
    }, []);
};

drawAllMaps = (geoData, csvData) => {
  drawMap(
    MAP_SIZE,
    geoData,
    csvData,
    "hg/ha_yield",
    d3.interpolatePurples,
    "#yield_map"
  );
  drawMap(
    MAP_SIZE,
    geoData,
    csvData,
    "average_rain_fall_mm_per_year",
    d3.interpolateBlues,
    "#rainfall_map"
  );
  drawMap(
    MAP_SIZE,
    geoData,
    csvData,
    "pesticides_tonnes",
    d3.interpolateGreens,
    "#pesticides_map"
  );
  drawMap(
    MAP_SIZE,
    geoData,
    csvData,
    "avg_temp",
    d3.interpolateReds,
    "#temp_map"
  );
};

const getLineChartData = (data) => {
  const totalYieldByCountry = data.reduce((acc, row) => {
    const country = row.Area;
    const yieldValue = parseFloat(row["hg/ha_yield"]);

    if (!acc[country]) {
      acc[country] = 0;
    }
    acc[country] += yieldValue;
    return acc;
  }, {});

  const topCountries = Object.entries(totalYieldByCountry)
    .sort(([, yieldA], [, yieldB]) => yieldB - yieldA)
    .slice(0, 10)
    .map(([country]) => country);

  return data
    .filter((row) => topCountries.includes(row.Area))
    .map((row) => ({
      name: row.Area,
      date: row.Year,
      value: parseFloat(row["hg/ha_yield"]),
    }))
    .reduce((acc, curr) => {
      const existing = acc.find(
        (item) => item.name === curr.name && item.date === curr.date
      );
      if (existing) {
        existing.value += curr.value;
      } else {
        acc.push({ name: curr.name, date: curr.date, value: curr.value });
      }
      return acc;
    }, []);
};

function drawHeatmap(data, container) {
  // Set up dimensions and margins
  const margin = { top: 60, right: 30, bottom: 140, left: 130 }; // Increased top margin for the label
  const width = 1100 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  let svg = d3.select(container).selectAll("svg").remove();
  svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Add label above the heatmap
  svg
    .append("text")
    .attr("x", width / 2) // Center the label horizontally
    .attr("y", -25) // Position above the chart
    .attr("text-anchor", "middle") // Align text to the center
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Yield per Hectare in Each Country in " + settingsState.year);

  // Aggregate data: Average hg/ha_yield for each Area-Item pair
  const aggregatedData = d3.rollup(
    data,
    (v) => d3.mean(v, (d) => d["hg/ha_yield"]),
    (d) => d.Area,
    (d) => d.Item
  );

  // Extract unique Areas (countries) and Items (crops)
  const areas = Array.from(aggregatedData.keys());
  const items = Array.from(new Set(data.map((d) => d.Item))).sort();

  // Prepare scales
  const x = d3.scaleBand().domain(areas).range([0, width]).padding(0.01);
  const y = d3.scaleBand().domain(items).range([0, height]).padding(0.01);
  const color = d3
    .scaleSequential(d3.interpolateYlGnBu)
    .domain([
      d3.min(data, (d) => d["hg/ha_yield"]),
      d3.max(data, (d) => d["hg/ha_yield"]),
    ]);
    const highlightColor = d3
    .scaleSequential(d3.interpolateRdPu)
    .domain([
      d3.min(data, (d) => d["hg/ha_yield"]),
      d3.max(data, (d) => d["hg/ha_yield"]),
    ]);

  // Add X-axis
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-90)") // Rotate text to be vertical
    .style("text-anchor", "end")
    .attr("dx", "-0.8em") // Adjust text position
    .attr("dy", "-0.7em");

  // Add Y-axis
  svg.append("g").call(d3.axisLeft(y));

  // Create tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "lightsteelblue")
    .style("border", "1px solid gray")
    .style("border-radius", "5px")
    .style("padding", "5px");

  // Draw heatmap
  svg
    .selectAll("rect")
    .data(
      Array.from(aggregatedData, ([area, itemsMap]) =>
        Array.from(itemsMap, ([item, yieldVal]) => ({
          area,
          item,
          yield: yieldVal,
        }))
      ).flat()
    )
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.area))
    .attr("y", (d) => y(d.item))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .style("fill", (d) => (d.area === settingsState.country ? highlightColor(d.yield) : color(d.yield))) // Handle missing values
    .style("stroke", (d) => (d.area === settingsState.country ? "#000" : "none")) // Handle missing values
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip
        .html(
          `Area: ${d.area}<br>Item: ${d.item}<br>Yield: ${d.yield.toFixed(2)}`
        )
        .style("left", event.pageX + 5 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () =>
      tooltip.transition().duration(500).style("opacity", 0)
    );
}

const drawLineChart = (chartData, container) => {
  // Specify the chart’s dimensions.
  const width = 800;
  const height = 400;
  const marginTop = 60; // Increased margin for the title
  const marginRight = 100;
  const marginBottom = 40;
  const marginLeft = 90;

  // Create the horizontal, vertical and color scales.
  const x = d3
    .scaleLinear()
    .domain([chartData[0].date, chartData[chartData.length - 1].date])
    .range([marginLeft, width - marginRight]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(chartData, (d) => d.value)])
    .range([height - marginBottom, marginTop]);

  const color = d3
    .scaleOrdinal()
    .domain(chartData.map((d) => d.name))
    .range(d3.schemeCategory10);

  let svg = d3.select(container).selectAll("svg").remove();
  svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  // Add chart title
  svg
    .append("text")
    .attr("x", width / 2) // Center the title
    .attr("y", 40) // Position above the chart
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(
      (settingsState.country === "Worldwide" ? "Top 10" : "") +
        " Yield Per Hectare Over Time"
    );

  // Add X-axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(width / 80)
        .tickFormat(d3.format("d")) // This removes the commas from the numbers
        .tickSizeOuter(0)
    );

  // Add "Year" label below the X-axis
  svg
    .append("text")
    .attr("x", (width - marginLeft - marginRight) / 2 + marginLeft) // Center the label
    .attr("y", height - 5) // Position below the X-axis
    .attr("fill", "currentColor")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Year");

  // Add a container for each series.
  const serie = svg
    .append("g")
    .selectAll()
    .data(d3.group(chartData, (d) => d.name))
    .join("g");

  // Draw the lines.
  serie
    .append("path")
    .attr("fill", "none")
    .attr("stroke", (d) => color(d[0]))
    .attr("stroke-width", 1.5)
    .attr("d", (d) =>
      d3
        .line()
        .x((d) => x(d.date))
        .y((d) => y(d.value))(d[1])
    );

  // Add Y-axis
  serie
    .append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).ticks(height / 40))
    .call((g) => g.select(".domain").remove())
    .call((g) =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("x2", width - marginLeft - marginRight)
        .attr("stroke-opacity", 0.1)
    )
    .call((g) =>
      g
        .append("text")
        .attr("transform", "rotate(-90)") // Rotate text to be vertical
        .attr("x", -height / 2)
        .attr("y", -marginLeft / 1.3)
        .attr("fill", "currentColor")
        .attr("text-anchor", "middle")
        .text("Yield Per Hectare")
    );

  // Append the labels.
  serie
    .append("g")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("text-anchor", "start")
    .selectAll()
    .data((d) => d[1])
    .join("text")
    .attr("dy", "0.35em")
    .attr("dx", "0.35em")
    .attr("x", (d) => x(d.date))
    .attr("y", (d) => y(d.value))
    .call((text) =>
      text
        .filter((d, i, data) => i === data.length - 1)
        .append("tspan")
        .attr("font-weight", "bold")
        .text((d) => ` ${d.name}`)
    )
    .style("fill", (d) => color(d.name))
    .clone(true)
    .lower()
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 6);
};

const drawPieChart = (data, container) => {
  const width = 400;
  const height = Math.min(width, 500);

  // Create the pastel color scale.
  const pastelColor = d3
    .scaleOrdinal()
    .domain(data.map((d) => d.name))
    .range(
      d3.schemePastel1.slice(0, data.length) // Use d3's built-in pastel palette
    );

  const pie = d3
    .pie()
    .sort(null)
    .value((d) => d.value);

  const arc = d3
    .arc()
    .innerRadius(0)
    .outerRadius(Math.min(width, height) / 2 - 1);

  const labelRadius = arc.outerRadius()() * 0.9;

  const arcLabel = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);

  const arcs = pie(data);
  let svg = d3.select(container).selectAll("svg").remove();
  svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  // Add a sector path for each value.
  svg
    .append("g")
    .attr("stroke", "white")
    .selectAll()
    .data(arcs)
    .join("path")
    .attr("fill", (d) => pastelColor(d.data.name))
    .attr("d", arc)
    .append("title")
    .text((d) => `${d.data.name}: ${d.data.value.toLocaleString("en-US")}`);

  // Add labels, ensuring they are always upright.
  svg
    .append("g")
    .selectAll()
    .data(arcs)
    .join("text")
    .attr("transform", (d) => {
      const [x, y] = arcLabel.centroid(d); // Label position
      const midAngle = (d.startAngle + d.endAngle) / 2; // Mid-angle in radians
      let rotate = (midAngle * 180) / Math.PI - 90; // Convert to degrees and adjust

      // Normalize the angle to keep text upright
      if (rotate > 90) rotate -= 180;
      if (rotate < -90) rotate += 180;

      return `translate(${x},${y}) rotate(${rotate})`;
    })
    .attr("text-anchor", (d) => {
      const midAngle = (d.startAngle + d.endAngle) / 2; // Mid-angle in radians
      const rotate = (midAngle * 180) / Math.PI - 90; // Convert to degrees
      return rotate > 90 ? "start" : "end"; // Dynamically set text-anchor
    })
    .style("fill", (d) => {
      const color = d3.color(pastelColor(d.data.name));
      return color ? color.darker(4).toString() : "black";
    })
    .style("font-size", "13px")
    .call((text) =>
      text
        .append("tspan")
        .attr("y", "0.4em")
        .text((d) => d.data.name)
    );

  // Add centered text with a white stroke and font size of 15px
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "15px")
    .style("stroke", "white") // Add white stroke around text
    .style("stroke-width", "2px") // Set the stroke width
    .style("stroke-linejoin", "round") // Smooth out the stroke corners
    .style("fill", "black") // Set the fill color for the text
    .text(settingsState.country + ", " + settingsState.year);

  // Add centered text with a font size of 15px
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "15px")
    .text(settingsState.country + ", " + settingsState.year);
};

const drawMap = (
  size,
  geoData,
  csvData,
  columnName,
  interpolator,
  container
) => {
  const parsedData = {};
  csvData.forEach((row) => {
    parsedData[row.Area] = row[columnName];
  });

  const projection = d3
    .geoMercator()
    .scale(size / 2.5 / Math.PI)
    .translate([size / 2.5, size / 1.9]);

  let svg = d3.select(container).selectAll("svg").remove();
  svg = d3
    .select(container)
    .append("svg")
    .attr("width", size)
    .attr("height", size);

  const d3parsedData = d3.extent(Object.values(parsedData));

  const interpolate =
    interpolator &&
    d3.scaleSequential().domain(d3parsedData).interpolator(interpolator);

  svg
    .append("g")
    .selectAll("path")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("fill", (d) => {
      const country = d.properties.name;
      const value = parsedData[country];
      return value ? interpolate(value) : "rgba(200,200,200,1)";
    })
    .attr("d", d3.geoPath().projection(projection))
    .style("stroke", (d) => (parsedData[d.properties.name] ? "#333" : "#333"))
    .style("stroke-width", 0.5);
};

const getMostPopularCropPerCountry = (csvData, year) => {
  const countriesData = csvData
    .filter((row) => row.Year === year)
    .reduce(function (r, e) {
      if (!r[e.Area]) r[e.Area] = e;
      else if (e["hg/ha_yield"] > r[e.Area]["hg/ha_yield"]) r[e.Area] = e;
      return r;
    });

  return countriesData;
};

const downloadCanvas = () => {
  html2canvas(document.querySelector("#canvas")).then((canvas) => {
    var link = document.createElement("a");
    link.download = "dashboard.png";
    link.href = canvas.toDataURL();
    link.click();
  });
};

