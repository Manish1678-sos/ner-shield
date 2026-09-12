import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Radio, MapPin, Camera } from 'lucide-react';

export default function IncidentDrawer({ open, onClose, onSubmit, offline }) {
    const [isOnline, setIsOnline] = useState(!offline);

    useEffect(() => {
        setIsOnline(!offline);
    }, [offline]);

    if (!open) return null;

    return (
        <motion.aside
            key="incident-drawer"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="drawer"
        >
            <div className="drawer-head">
                <div>
                    <span className="eyebrow">FIELD REPORTER</span>
                    <h2>Broadcast incident</h2>
                </div>
                <button type="button" className="icon-btn" onClick={onClose} aria-label="Close Drawer">
                    <X size={18} />
                </button>
            </div>

            <form onSubmit={onSubmit}>
                <label>
                    GPS coordinates (Lat, Lon)
                    <input
                        name="coordinates"
                        defaultValue="25.1240, 92.3610"
                        placeholder="25.1240, 92.3610 (NH-6 Sonapur)"
                        required
                    />
                </label>

                <label>
                    Incident type
                    <select name="type" defaultValue="Landslide">
                        <option value="Landslide">Landslide / Rockfall</option>
                        <option value="Flash Flood">Flash Flood / River Inundation</option>
                        <option value="Road Subsidence">Road Subsidence / Cut-off</option>
                    </select>
                </label>

                <label>
                    Severity
                    <select name="severity" defaultValue="CRITICAL">
                        <option value="CRITICAL">CRITICAL (Impassable)</option>
                        <option value="HIGH">HIGH (Single Lane Only)</option>
                        <option value="MODERATE">MODERATE (Hazard Warning)</option>
                    </select>
                </label>

                <label>
                    Evidence photo
                    <input name="photo" type="file" accept="image/*" />
                </label>

                <div className="offline-row">
                    <span>
                        <Radio size={15} /> {!isOnline ? 'OFFLINE (QUEUED)' : 'ONLINE'}
                    </span>
                    <input
                        type="checkbox"
                        name="online"
                        checked={isOnline}
                        onChange={(e) => setIsOnline(e.target.checked)}
                    />
                </div>

                <button className="alert-btn" type="submit">
                    <MapPin size={17} /> BROADCAST BLOCKAGE ALERT
                </button>
            </form>
        </motion.aside>
    );
}