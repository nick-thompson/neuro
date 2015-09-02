#!/usr/bin/env python

import matplotlib.pyplot as plt
import numpy as np
import math

z_one = None
z_two = None

def without_resampling():
    # Plot the axes in grey.
    plt.axhline(linewidth=1, color='#bbbbbb')
    plt.axvline(linewidth=1, color='#bbbbbb')

    # The X domain here is modeled with 100 sample frames per cycle which
    # approximates an A4 sine wave playing at 44,100Hz. In the resampling step,
    # we'll take this number down to show the phasing artifacts introduced.
    x = np.linspace(0, 8 * np.pi, 400)

    y = np.sin(x) # First oscillator from the generator
    yp = np.sin(1.0265 * x) # Second oscillator from the generator.

    # This is a detune factor of +24 cents. A little unrealistic for the sound we
    # want, but helps clarify what's happening in the graphical representation.
    detune_factor = math.pow(2.0, (24.0 / 1200.0))

    ypp = np.sin(detune_factor * x) # First oscillator detuned
    yppp = np.sin(detune_factor * 1.0265 * x) # Second oscillator detuned

    plt.plot(x, y, 'm')
    plt.plot(x, yp, 'c')
    plt.plot(x, ypp, 'y')
    plt.plot(x, yppp, 'g')

    # Now the summation to show the phasing
    global z_one
    z_one = 0.25 * (y + yp + ypp + yppp)
    plt.plot(x, z_one, 'k')

    plt.axis('tight')

def with_resampling():
    # Plot the axes in grey.
    plt.axhline(linewidth=1, color='#bbbbbb')
    plt.axvline(linewidth=1, color='#bbbbbb')

    # The X domain here is modeled with 100 sample frames per cycle which
    # approximates an A4 sine wave playing at 44,100Hz. In the resampling step,
    # we'll take this number down to show the phasing artifacts introduced.
    x = np.linspace(0, 8 * np.pi, 400)

    # We'll need these two because in `stepTwo` we play the raw buffer next to
    # the resampled buffer. These two represent the raw buffer.
    y = np.sin(x) # First oscillator from the generator
    yp = np.sin(1.0265 * x) # Second oscillator from the generator.

    # Same detune factor of +24 cents
    detune_factor = math.pow(2.0, (24.0 / 1200.0))

    # The resampled buffers drop samples, thus their array size is not the same
    # as `x`, `yp`, or `ypp`.
    size = int(math.floor(400.0 / detune_factor))
    xp = np.linspace(0, 8 * np.pi, size)
    ypp = np.zeros_like(xp)

    # Chromium's detune implementation ported here for our experiment.
    yyp = 0.5 * (y + yp)
    virtual_read_index = 1.0
    playback_rate = detune_factor
    for i in range(size):
        write_index = i
        read_index = math.floor(virtual_read_index)
        read_index2 = read_index + 1
        interp_factor = virtual_read_index - read_index
    
        if read_index2 >= size - 1:
            read_index2 = read_index
        if read_index >= size - 1:
            break
    
        sample1 = yyp[read_index]
        sample2 = yyp[read_index2]
        current_sample = (1.0 - interp_factor) * sample1 + interp_factor * sample2
    
        ypp[write_index] = current_sample
        virtual_read_index = virtual_read_index + playback_rate

    plt.plot(x, y, 'm')
    plt.plot(x, yp, 'c')
    plt.plot(xp, ypp, 'y')

    # Now the summation to show the phasing
    global z_two
    z_two = y + yp
    z_two[:len(ypp)] += ypp
    z_two = 0.33 * z_two
    plt.plot(x, z_two, 'k')

    plt.axis('tight')

def show_difference():
    # Plot the axes in grey.
    plt.axhline(linewidth=1, color='#bbbbbb')
    plt.axvline(linewidth=1, color='#bbbbbb')

    x = np.linspace(0, 8 * np.pi, 400)
    plt.plot(x, z_one, '#ffffff')
    plt.plot(x, z_two, '#ffffff')

    plt.fill_between(x, z_one, z_two, where=z_one>=z_two, facecolor='c', interpolate=True)
    plt.fill_between(x, z_one, z_two, where=z_one<=z_two, facecolor='c', interpolate=True)

    plt.axis('tight')

if __name__ == '__main__':
    plt.figure()

    # Plot the same plot on top of itself for interesting zooming perspective
    plt.subplot(231)
    without_resampling()
    plt.subplot(234)
    without_resampling()

    plt.subplot(232)
    with_resampling()
    plt.subplot(235)
    with_resampling()

    plt.subplot(233)
    show_difference()
    plt.subplot(236)
    show_difference()

    plt.show()
