import React from 'react';

interface FooterProps {
  lastUpdate: string;
}

const Footer = ({ lastUpdate }: FooterProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-10">
      <p className="text-xs text-gray-500 text-center">
        Last updated: {lastUpdate}
      </p>
    </div>
  );
};

export default Footer;