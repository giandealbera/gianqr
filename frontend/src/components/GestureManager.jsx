import useEdgeSwipeBack from '../hooks/useEdgeSwipeBack';

// Wrapper "noop" para hookear gestures globales que viven dentro del
// BrowserRouter (sino los hooks de react-router no se pueden usar).
// Por ahora solo: edge-swipe-back en standalone PWA. Si suman gestos
// globales mas adelante (pull-to-refresh global, por ej), va aca.
const GestureManager = () => {
  useEdgeSwipeBack();
  return null;
};

export default GestureManager;
