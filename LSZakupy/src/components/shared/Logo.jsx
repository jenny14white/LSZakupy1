export default function Logo({ className = 'logo' }) {
  return (
    <img
      src="/logo.png"
      alt="LS logo"
      className={className}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}
