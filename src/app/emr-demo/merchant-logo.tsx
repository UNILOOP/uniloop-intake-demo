import React from 'react';

/** Hosted merchant layouts call logo(className), including merchants without a logo. */
export function createMerchantLogo(merchant: any) {
  return function MerchantLogo(className = 'h-6 w-auto') {
    const business = merchant?.business;
    const source =
      business?.logo_url ||
      business?.logo_light_url ||
      business?.logo_dark_url ||
      merchant?.logo;
    const name = merchant?.name || business?.name || 'Uniloop';
    return source ? (
      <img src={source} alt={name} className={className} />
    ) : (
      <span className={className}>{name}</span>
    );
  };
}
