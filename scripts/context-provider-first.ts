import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ProviderFirstEntrance from '../src/components/ProviderFirstEntrance';
import type {PublishedProvider} from '../src/lib/sector-comparison';
export const renderProviderFirst=(providers:PublishedProvider[],unavailable:string[])=>renderToStaticMarkup(React.createElement(ProviderFirstEntrance,{providers,unavailable}));
