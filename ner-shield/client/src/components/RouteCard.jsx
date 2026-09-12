export default function RouteCard({ title, route, color, selected, onClick }) {
    const riskVal =
        typeof route?.risk === 'number'
            ? route.risk
            : route?.risk !== undefined && route?.risk !== null
                ? Number(route.risk)
                : null;

    const riskDisplay = riskVal !== null && !isNaN(riskVal) ? riskVal.toFixed(2) : '--';
    const isBlocked = riskVal !== null && riskVal > 0.8;
    const isHighRisk = riskVal !== null && riskVal > 0.6;
    const statusText = isBlocked ? 'BLOCKED' : isHighRisk ? 'HIGH RISK' : 'CLEAR';

    return (
        <button
            type="button"
            className={`route-card ${selected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="route-card-top">
                <span className="route-line" style={{ background: color }} />
                <span>{title}</span>
                <b>{riskDisplay}</b>
            </div>

            <div className="route-stats">
                <strong>
                    {route?.eta ?? '--'} <small>MIN</small>
                </strong>
                <strong>
                    {route?.distance ?? '--'} <small>KM</small>
                </strong>
                <em>{statusText}</em>
            </div>
        </button>
    );
}