import { motion } from 'framer-motion';

// Indicador visual del pull-to-refresh: arquito que aparece arriba mientras
// tiras hacia abajo, y se completa cuando ya pasaste el umbral. Cuando
// progress >= 1 se ve dorado (listo para soltar). Se monta solo cuando
// pulling=true asi no ocupa el DOM cuando no esta activo.
const PullIndicator = ({ pulling, progress }) => {
  if (!pulling) return null;
  const ready = progress >= 1;
  const size  = 18 + progress * 8;   // crece con el pull
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: Math.min(progress, 1) }}
      className="fixed top-0 left-0 right-0 z-[55] flex justify-center pointer-events-none pt-safe"
    >
      <div className="mt-3 rounded-full p-2"
           style={{ background: 'rgba(7,9,14,0.85)', backdropFilter: 'blur(6px)' }}>
        <svg
          width={size} height={size} viewBox="0 0 24 24"
          fill="none" stroke={ready ? '#C9974D' : '#6B7280'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: `rotate(${progress * 360}deg)`, transition: 'transform 60ms linear' }}
        >
          <path d="M21 12a9 9 0 1 1-9-9" />
          <path d="M21 3v9h-9" />
        </svg>
      </div>
    </motion.div>
  );
};

export default PullIndicator;
