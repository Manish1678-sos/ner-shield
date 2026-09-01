import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({ name:String, email:{type:String,unique:true}, password:String, role:{type:String,default:'FIELD_DRIVER'} }, {timestamps:true});
const incidentSchema = new mongoose.Schema({ type:String, severity:String, coordinates:[Number], photo:String, online:Boolean, status:{type:String,default:'VERIFIED'}, riskScore:Number }, {timestamps:true});
const routeSchema = new mongoose.Schema({ origin:String, destination:String, priority:String, primary:Object, bypass:Object, selectedRoute:String, active:Boolean }, {timestamps:true});
const dispatchSchema = new mongoose.Schema({ cargoId:String, cargoType:String, priority:String, temperature:String, location:String, eta:Number, routeId:String, status:String }, {timestamps:true});
export const User = mongoose.model('User', userSchema); export const Incident = mongoose.model('Incident', incidentSchema); export const Route = mongoose.model('Route', routeSchema); export const Dispatch = mongoose.model('Dispatch', dispatchSchema);
