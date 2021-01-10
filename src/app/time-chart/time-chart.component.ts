import { Component, ElementRef, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import * as d3 from 'd3';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface BTCraw {
  "24h High (USD)": string;
  "24h Low (USD)": string;
  "24h Open (USD)": string;
  "Closing Price (USD)": string;
  "Currency": string;
  "Date": string;
}

interface Serie {
  date: Date;
  price: number;
}

@Component({
  selector: 'app-time-chart',
  templateUrl: './time-chart.component.html',
  styleUrls: ['./time-chart.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TimeChartComponent implements OnInit {
  @ViewChild('svgRef') svgRef: ElementRef<any>;

  /**
   * 寬度(default: 800)
   * 整體SVG寬度
   */
  @Input() width = 800;

  /**
   * 高度(default: 600)
   * 整體SVG高度
   */
  @Input() height = 600;

  /**
   * 退縮區(default: 15)
   * 退縮Axis比例尺的尺標字體，以免遮擋
   */
  @Input() padding = {
    top: 15,
    right: 20,
    bottom: 20,
    left: 55
  };

  series: Serie[] = [];

  xScale: d3.ScaleTime<number, number, never>;
  yScale;
  xExtent: [Date, Date];
  yExtent: [number, number];
  xAxis;
  yAxis;
  zoom;
  zoomX;

  constructor() {
  }

  ngOnInit(): void {
    this.getData().subscribe(resp => {
      this.series = resp;
      this.go();
    });
  }

  go(): void {
    this.compute();
    this.render();
  }

  /**
   * Compute 相關
   */
  compute(): void {
    this.computeExtent();
    this.computeScale();
    this.computeAxis();
    this.computeZoom();
  }

  /**
   * Compute Extent
   */
  computeExtent(): void {
    this.xExtent = d3.extent(this.series.map(serie => serie.date));
    this.yExtent = d3.extent(this.series.map(serie => serie.price));
  }

  /**
   * Compute Scale
   */
  computeScale(): void {
    this.xScale = d3.scaleTime().domain(this.xExtent).range([0, this.canvasWidth]).nice();
    this.yScale = d3.scaleLinear().domain(this.yExtent).range([this.canvasHeight, 0]);
  }

  /**
   * Compute Axis
   */
  computeAxis(): void {
    this.yAxis = d3.axisLeft(this.yScale)
        .tickSize(-this.canvasWidth);

    this.xAxis = d3
        .axisBottom(this.xScale)
        .tickSizeOuter(-this.canvasHeight)
        .ticks(12,  d3.utcFormat("%Y/%m"))
  }

  /**
   * Compute Zoom
   */
  computeZoom(): void {
    const extent = [
      [0, 0],
      [this.canvasWidth, this.canvasHeight],
    ];
    this.zoom = d3.zoom()
                .scaleExtent([1, 4])
                .extent(extent as any)
                .translateExtent(extent as any)
                .on('zoom', event => this.zoomed(event));
    this.svgSelection.call(this.zoom);
  }


  /**
   * Zoom事件
   */
  zoomed(event): void {
    this.yScale.range([this.canvasHeight, 0].map(d => event.transform.applyY(d)));
    this.computeAxis();
    this.render();

  }

  /**
   * Render 相關
   */
  render(): void {
    this.renderAxis();
    this.renderLine();
  }

  /**
   * Render Axis
   */
  renderAxis(): void {
    this.xAxisLayer.attr('class', 'axis x-axis')
        .transition()
        .duration(50)
        .call(this.xAxis)
        .attr('transform', `translate(0, ${this.canvasHeight})`);

    this.yAxisLayer.attr('class', 'axis y-axis')
        .transition()
        .duration(50)
        .call(this.yAxis);
  }

  /**
   * Render Line
   */
  renderLine(): void {
    let line = d3.line<Serie>()
                .x(d => this.xScale(d.date))
                .y(d => this.yScale(d.price))

    let lines = this.linesLayer
                  .selectAll('path')
                  .data<Serie[]>([this.series])

    let enter = lines.enter().append<d3.BaseType>('path');

    enter.merge(lines)
      .transition()
      .duration(50)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
  }


  /**
   * 取得比特幣報價
   */
  getData(): Observable<Serie[]> {
    return from(d3.csv('assets/btc.csv') as Promise<BTCraw[]>)
              .pipe(
                map(resp => resp.map(raw =>
                  ({ date: new Date(raw.Date), price: +raw['Closing Price (USD)']})
                )
              )
            )
  }

  /**
   * 整體SVG去除Padding後的寬度
   * (實際繪圖區域大小)
   */
  get canvasWidth(): number {
    return this.viewBoxWidth - (this.padding.left + this.padding.right);
  }

  /**
   * 整體SVG去除Padding後的長度
   * (實際繪圖區域大小)
   */
  get canvasHeight(): number {
    return this.viewBoxHeight - (this.padding.top + this.padding.bottom);
  }

  /**
   * 取得個圖層
   */
  get svgSelection(): d3.Selection<any, unknown, null, undefined> {
    return d3.select(this.svgRef.nativeElement)
  }
  get rootLayer(): d3.Selection<any, unknown, null, undefined> {
    return this.svgSelection.select('#rootLayer');
  }
  get axisLayer(): d3.Selection<any, unknown, null, undefined> {
    return this.svgSelection.select('#axisLayer');
  }
  get xAxisLayer(): d3.Selection<any, unknown, null, undefined> {
    return this.svgSelection.select('#xAxisLayer');
  }
  get yAxisLayer(): d3.Selection<any, unknown, null, undefined> {
    return this.svgSelection.select('#yAxisLayer');
  }
  get linesLayer(): d3.Selection<any, unknown, null, undefined> {
    return this.svgSelection.select('#linesLayer');
  }

  /**
   * 位移RootLayer
   */
  get rootTransform(): string {
    return `translate(${this.padding.left}, ${this.padding.top})`;
  }

  get viewBoxWidth() {
    return this.width;
  }

  get viewBoxHeight() {
    return this.height;
  }

  get svgViewBox(): string {
    return `0 0 ${this.viewBoxWidth} ${this.viewBoxHeight}`;
  }
}
