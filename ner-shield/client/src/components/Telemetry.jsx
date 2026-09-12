export default function Telemetry({ metrics }) {
    const safeMetrics = {
        rainfall: metrics?.rainfall ?? 0,
        soil: metrics?.soil ?? 0,
        slope: metrics?.slope ?? 0,
        risk: typeof metrics?.risk === 'number' ? metrics.risk : Number(metrics?.risk) || 0
    };

    const metricCards = [
        ['24H RAINFALL', `${safeMetrics.rainfall} mm`, 'rain'],
        ['SOIL MOISTURE', `${safeMetrics.soil}%`, 'soil'],
        ['SLOPE', `${safeMetrics.slope}°`, 'slope'],
        ['RISK SCORE', safeMetrics.risk.toFixed(2), 'risk']
    ];

    const isBlocked = safeMetrics.risk > 0.8;
    const isHighRisk = safeMetrics.risk > 0.6;
    const statusLabel = isBlocked ? 'BLOCKED' : isHighRisk ? 'HIGH RISK' : 'MONITORING';

    return (
        <section className="telemetry">
            <div className="telemetry-title">
                <span className="eyebrow">LIVE TELEMETRY</span>
                <span className="signal"><i /> SIGNAL 98%</span>
            </div>

            <div className="metric-grid">
                {metricCards.map(([label, value, kind]) => (
                    <div className="metric" key={label}>
                        <span>{label}</span>
                        <strong className={kind}>{value}</strong>
                        <small>{kind === 'risk' ? 'AI PREDICTION' : 'SENSOR FEED'}</small>
                    </div>
                ))}

                <div className="status-metric">
                    <span>RISK STATUS</span>
                    <strong className={isBlocked ? 'blocked' : ''}>{statusLabel}</strong>
                    <small>ROAD NETWORK</small>
                </div>
            </div>
        </section>
    );
}