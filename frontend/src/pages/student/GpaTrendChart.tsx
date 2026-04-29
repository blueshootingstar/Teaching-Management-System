import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

interface GpaTrendChartProps {
  labels: string[];
  values: Array<number | null>;
  visible: boolean;
}

export default function GpaTrendChart({ labels, values, visible }: GpaTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const labelsRef = useRef(labels);
  const valuesRef = useRef(values);
  const visibleRef = useRef(visible);

  labelsRef.current = labels;
  valuesRef.current = values;
  visibleRef.current = visible;

  const clearRetry = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleResize = () => {
    const chart = chartRef.current;
    if (!chart) return;
    window.requestAnimationFrame(() => {
      chart.resize();
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = window.setTimeout(() => {
        chart.resize();
      }, 120);
    });
  };

  const renderChart = () => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      if (visibleRef.current) {
        clearRetry();
        retryTimerRef.current = window.setTimeout(renderChart, 80);
      }
      return;
    }

    if (!chartRef.current) {
      chartRef.current = echarts.init(container);
    }

    const chartLabels = labelsRef.current;
    const chartValues = valuesRef.current;
    const hasData = chartValues.some((value) => value !== null && value !== undefined);
    chartRef.current.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 24, top: 36, bottom: 36 },
      xAxis: { type: 'category', data: chartLabels },
      yAxis: { type: 'value', min: 0, max: 4, interval: 1 },
      graphic: hasData
        ? []
        : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: '暂无可展示的绩点数据',
              fill: '#9ca3af',
              fontSize: 14
            }
          }
        ],
      series: [
        {
          name: '学期平均绩点',
          type: 'bar',
          data: chartValues,
          barMaxWidth: 48,
          itemStyle: { color: '#1677ff' }
        },
        {
          name: '学期平均绩点',
          type: 'line',
          data: chartValues,
          smooth: true,
          symbolSize: 8,
          lineStyle: { width: 3, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' }
        }
      ]
    }, true);

    if (visibleRef.current) {
      scheduleResize();
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      renderChart();
      scheduleResize();
    });
    observer.observe(container);
    window.addEventListener('resize', scheduleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleResize);
      clearRetry();
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    renderChart();
  }, [labels, values, visible]);

  return <div ref={containerRef} className="gpa-chart" data-testid="gpa-chart" />;
}
