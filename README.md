# max-midi-learn #

A simple to use - plug-n-play - MIDI learning system for Max/MSP projects.

![max-midi-learn](http://i.imgur.com/HWzNhyX.png)

## Features

 * Supports all enabled MIDI devices
 * Supports routing of multiple MIDI controllers to a single object in Max/MSP
 * Supports single MIDI controller to control multiple objects in Max/MSP
 * Intuitive graphical interface for hiliting objects in Max to arm them for learning
 * Supports persistent storage of learned assignments
 
 
## How to use from a user's perspective ##
 
 * Enable MIDI learn mode
 * Mouse-click on an object in your Max/MSP GUI to hilite the object and arm it for MIDI learn.
    * An item hilited pink has no current assignments
    * An item hilited green has a current assignment
    * Items can have multiple assignments

**Example of an item hilited and ready for controller input**
![max-midi-learn](http://i.imgur.com/JBFr6JI.png)

 * Once an item is hilited and recieves MIDI controller input, this assignment is saved and the item is unhilited.
 * An item that is hilited with green already has a controller assigned to it, however, it is possible to assign multiple controllers to a single object.
 
![max-midi-learn](http://i.imgur.com/QrQRY86.png) 
 
 * If multiple items are hilited and a MIDI controller value is registered, this object will respond to multiple MIDI controllers

![max-midi-learn](http://i.imgur.com/13RuMjn.png) 


 * Shift clicking on any green hilited object will remove all currently stored assignments
 

*Note: Persistance is automatic (i.e., saving to disk is automatic)*


## How to use from a developer's perspective ##

![max-midi-learn](http://i.imgur.com/Pbkr6HH.png) 

The MIDI learn system is encapsulated into a single Max patcher and a javascript file. The included project shows an example of how this patcher can be used.

This implementation requires that your project use the Max/MSP pattr system, specifically the pattrstorage system. All objects that are recognized by the pattstorage system are automatically included in the midi learn system.

The inputs of the midilearn object inputs are as follows:

 * MIDI learn mode on/off (0/1)
 * MIDI on/off (0/1)
 * Output of your pattrstorage object
 * Assigned hilite color
 * Unassigned hilite color
 * logging mode on/off
 
The output of the midilearn object must be connected to the input of your pattrstorage object
